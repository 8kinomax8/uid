<?php
/**
 * Plugin Name: UID Headless
 * Description: Contrats ACF, galerie et reconstruction locale du site Astro UID.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) { exit; }

add_action('after_setup_theme', function () {
    $support = get_theme_support('post-thumbnails');
    if (!$support) { add_theme_support('post-thumbnails', array('evenements')); }
    elseif (is_array($support) && isset($support[0]) && is_array($support[0])) {
        add_theme_support('post-thumbnails', array_unique(array_merge($support[0], array('evenements'))));
    }
}, 100);

function uid_page_ids() {
    return array_values(array_filter(array_map(function ($name) { return defined($name) ? absint(constant($name)) : 0; }, array('UID_LUTINS_PAGE_ID', 'UID_AVENTURIERS_PAGE_ID', 'UID_CALENDAR_PAGE_ID'))));
}
function uid_is_content($id) { return get_post_type($id) === 'evenements' || in_array((int) $id, uid_page_ids(), true); }
function uid_state_dir() {
    if (!defined('UID_STATE_DIR')) { return false; }
    $dir = realpath(UID_STATE_DIR);
    $root = defined('UID_DOCUMENT_ROOT') ? realpath(UID_DOCUMENT_ROOT) : (isset($_SERVER['DOCUMENT_ROOT']) ? realpath($_SERVER['DOCUMENT_ROOT']) : false);
    if (!$dir || !$root || $dir === $root || strpos($dir . '/', $root . '/') === 0 || !is_writable($dir)) { return false; }
    return $dir;
}
function uid_queue_rebuild($id = 0) {
    if ($id && (wp_is_post_revision($id) || wp_is_post_autosave($id))) { return; }
    if ($id && !uid_is_content($id) && get_post_type($id) !== 'attachment') { return; }
    $dir = uid_state_dir();
    if (!$dir) { return; }
    // One immutable marker per request: the worker acknowledges only its snapshot.
    static $queued = false;
    if ($queued) { return; }
    $token = wp_generate_uuid4();
    $path = $dir . '/pending-' . $token . '.json';
    $temporary = $path . '.tmp';
    if (file_put_contents($temporary, wp_json_encode(array('at' => gmdate('c'), 'post' => (int) $id)), LOCK_EX) !== false) {
        chmod($temporary, 0600);
        if (rename($temporary, $path)) { $queued = true; }
    }
}
// Enqueue at shutdown, after ACF, featured images and REST additional fields have saved.
function uid_schedule_rebuild($id) {
    if (wp_is_post_revision($id) || wp_is_post_autosave($id)) { return; }
    if (uid_is_content($id) || get_post_type($id) === 'attachment') {
        add_action('shutdown', function () { uid_queue_rebuild(); });
    }
}
add_action('acf/save_post', 'uid_schedule_rebuild', 30);
add_action('save_post', 'uid_schedule_rebuild', 100);
add_action('before_delete_post', 'uid_schedule_rebuild');
add_action('delete_attachment', 'uid_schedule_rebuild');
add_action('edit_attachment', 'uid_schedule_rebuild');
add_action('add_attachment', 'uid_schedule_rebuild');
foreach (array('added_post_meta', 'updated_post_meta', 'deleted_post_meta') as $hook) {
    add_action($hook, function ($meta_id, $id, $key) {
        if (get_post_type($id) === 'attachment' || (uid_is_content($id) && ($key === '_thumbnail_id' || $key === 'uid_gallery_ids'))) { uid_schedule_rebuild($id); }
    }, 10, 3);
}

add_action('acf/init', function () {
    $groups = json_decode(file_get_contents(__DIR__ . '/acf-fields.json'), true);
    foreach ($groups as $group) {
        if ($group['key'] === 'group_uid_sessions') {
            $group['location'] = array();
            foreach (array('UID_LUTINS_PAGE_ID', 'UID_AVENTURIERS_PAGE_ID') as $constant) {
                if (defined($constant) && constant($constant)) { $group['location'][] = array(array('param' => 'post', 'operator' => '==', 'value' => (string) constant($constant))); }
            }
        } elseif ($group['key'] === 'group_uid_calendar') {
            $group['location'] = defined('UID_CALENDAR_PAGE_ID') ? array(array(array('param' => 'post', 'operator' => '==', 'value' => (string) UID_CALENDAR_PAGE_ID))) : array();
        }
        if ($group['location']) { acf_add_local_field_group($group); }
    }
});

function uid_gallery_sanitize($ids) {
    return array_values(array_unique(array_filter(array_map('absint', (array) $ids), function ($id) { return wp_attachment_is_image($id); })));
}
add_action('init', function () {
    register_post_meta('evenements', 'uid_gallery_ids', array(
        'type' => 'array', 'single' => true, 'default' => array(),
        'show_in_rest' => array('schema' => array('type' => 'array', 'items' => array('type' => 'integer', 'minimum' => 1))),
        'sanitize_callback' => 'uid_gallery_sanitize',
        'auth_callback' => function ($allowed, $key, $id) { return current_user_can('edit_post', $id); },
    ));
});
add_action('add_meta_boxes_evenements', function () {
    remove_meta_box('postcustom', 'evenements', 'normal');
    add_meta_box('uid-gallery', 'Photos de l’événement', function ($post) {
        wp_nonce_field('uid_gallery', 'uid_gallery_nonce');
        $ids = uid_gallery_sanitize(get_post_meta($post->ID, 'uid_gallery_ids', true));
        echo '<input type="hidden" id="uid-gallery-ids" name="uid_gallery_ids" value="' . esc_attr(implode(',', $ids)) . '">';
        echo '<p>Ajoutez des photos, puis utilisez les flèches pour les ordonner.</p><ul id="uid-gallery-list">';
        foreach ($ids as $id) { echo '<li data-id="' . esc_attr($id) . '">' . wp_get_attachment_image($id, 'thumbnail') . '<button type="button" data-move="-1" aria-label="Déplacer avant">↑</button><button type="button" data-move="1" aria-label="Déplacer après">↓</button><button type="button" data-remove>Retirer</button></li>'; }
        echo '</ul><button type="button" class="button" id="uid-gallery-add">Ajouter des photos</button>';
    }, 'evenements');
});
add_action('admin_enqueue_scripts', function () {
    $screen = get_current_screen();
    if (!$screen || $screen->post_type !== 'evenements') { return; }
    wp_enqueue_media();
    wp_enqueue_script('uid-gallery', plugins_url('gallery.js', __FILE__), array('media-views'), '1.0.0', true);
});
add_action('save_post_evenements', function ($id) {
    if (wp_is_post_revision($id) || wp_is_post_autosave($id) || !current_user_can('edit_post', $id)) { return; }
    if (!isset($_POST['uid_gallery_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['uid_gallery_nonce'])), 'uid_gallery')) { return; }
    update_post_meta($id, 'uid_gallery_ids', uid_gallery_sanitize(explode(',', sanitize_text_field(wp_unslash($_POST['uid_gallery_ids'] ?? '')))));
});

// Use the classic editing form, with native title/thumbnail and ACF, no page builder.
add_filter('use_block_editor_for_post', function ($use, $post) { return uid_is_content($post->ID) ? false : $use; }, 10, 2);
add_filter('use_block_editor_for_post_type', function ($use, $type) { return $type === 'evenements' ? false : $use; }, 10, 2);
add_action('admin_init', function () {
    if (isset($_GET['post']) && in_array(absint($_GET['post']), uid_page_ids(), true)) { remove_post_type_support('page', 'editor'); }
});
function uid_submitted_field($name, $id, $rest = null) {
    if (is_array($rest) && array_key_exists($name, $rest)) { return $rest[$name]; }
    $key = 'field_uid_' . $name;
    if (isset($_POST['acf']) && array_key_exists($key, $_POST['acf'])) { return wp_unslash($_POST['acf'][$key]); }
    return get_post_meta($id, $name, true);
}
function uid_valid_local_date($value, $format) {
    $date = DateTimeImmutable::createFromFormat('!' . $format, $value, new DateTimeZone('Europe/Zurich'));
    return $date && $date->format($format) === $value;
}
function uid_validation_error($type, $id, $title, $thumbnail, $acf = null) {
    if (defined('UID_CALENDAR_PAGE_ID') && (int) $id === (int) UID_CALENDAR_PAGE_ID) {
        $calendar = uid_submitted_field('google_calendar_id', $id, $acf);
        return $calendar && !preg_match('/^[^\s<>]+@[^\s<>]+$/', $calendar) ? 'Utilisez l’identifiant Google Calendar, pas une URL ou un code iframe.' : '';
    }
    if ($type === 'evenements') {
        foreach (array('description', 'date_heure', 'lieu') as $name) { if (!trim((string) uid_submitted_field($name, $id, $acf))) { return 'Complétez la description, la date et le lieu.'; } }
        if (!trim(wp_strip_all_tags($title)) || !wp_attachment_is_image($thumbnail)) { return 'Un titre et une image principale sont requis.'; }
        if (!uid_valid_local_date(uid_submitted_field('date_heure', $id, $acf), 'Y-m-d H:i:s')) { return 'La date de l’événement est invalide.'; }
        $url = uid_submitted_field('lien_externe', $id, $acf);
        if ($url && !preg_match('~^https?://~i', $url)) { return 'Le lien doit utiliser http ou https.'; }
    } elseif (in_array((int) $id, uid_page_ids(), true) && (!defined('UID_CALENDAR_PAGE_ID') || (int) $id !== (int) UID_CALENDAR_PAGE_ID)) {
        if (!uid_submitted_field('session_active', $id, $acf)) { return ''; }
        foreach (array('session_affiche', 'session_date', 'session_heure_debut', 'session_heure_fin', 'session_inscription_url') as $name) { if (!uid_submitted_field($name, $id, $acf)) { return 'Complétez tous les champs de la session active.'; } }
        $day = uid_submitted_field('session_date', $id, $acf);
        // ACF stores dates as Ymd, while its REST adapter may submit Y-m-d.
        if (preg_match('/^\d{8}$/', $day)) { $day = substr($day, 0, 4) . '-' . substr($day, 4, 2) . '-' . substr($day, 6, 2); }
        $start = uid_submitted_field('session_heure_debut', $id, $acf);
        $end = uid_submitted_field('session_heure_fin', $id, $acf);
        if (!uid_valid_local_date($day . ' ' . $start, 'Y-m-d H:i:s') || !uid_valid_local_date($day . ' ' . $end, 'Y-m-d H:i:s') || $end <= $start) { return 'Vérifiez la date et les horaires de la session.'; }
        if (!wp_attachment_is_image(uid_submitted_field('session_affiche', $id, $acf))) { return 'Choisissez une affiche valide.'; }
        if (!preg_match('~^https?://~i', uid_submitted_field('session_inscription_url', $id, $acf))) { return 'Le lien d’inscription doit utiliser http ou https.'; }
    }
    return '';
}
add_action('acf/validate_save_post', function () {
    $id = isset($_POST['post_ID']) ? absint($_POST['post_ID']) : 0;
    if (!$id || !uid_is_content($id)) { return; }
    $error = uid_validation_error(get_post_type($id), $id, wp_unslash($_POST['post_title'] ?? get_the_title($id)), max(0, (int) ($_POST['_thumbnail_id'] ?? get_post_thumbnail_id($id))));
    if ($error) { acf_add_validation_error('', $error); }
});
foreach (array('evenements', 'page') as $type) {
    add_filter('rest_pre_insert_' . $type, function ($prepared, $request) use ($type) {
        $id = absint($request['id']);
        if ($type === 'page' && !in_array($id, uid_page_ids(), true)) { return $prepared; }
        $status = $prepared->post_status ?? ($id ? get_post_status($id) : 'draft');
        if (!in_array($status, array('publish', 'future'), true)) { return $prepared; }
        $error = uid_validation_error($type, $id, $prepared->post_title ?? get_the_title($id), $request->has_param('featured_media') ? absint($request['featured_media']) : get_post_thumbnail_id($id), (array) $request['acf']);
        return $error ? new WP_Error('uid_invalid_content', $error, array('status' => 400)) : $prepared;
    }, 10, 2);
}
// Quick edit / programmatic publication must not bypass required fields.
add_filter('wp_insert_post_data', function ($data, $postarr) {
    $id = absint($postarr['ID'] ?? 0);
    if (defined('REST_REQUEST') && REST_REQUEST) { return $data; }
    if (($data['post_type'] === 'evenements' || in_array($id, uid_page_ids(), true)) && in_array($data['post_status'], array('publish', 'future'), true)) {
        $error = uid_validation_error($data['post_type'], $id, $data['post_title'], max(0, (int) ($_POST['_thumbnail_id'] ?? get_post_thumbnail_id($id))));
        if ($error) { $data['post_status'] = 'draft'; }
    }
    return $data;
}, 10, 2);

register_activation_hook(__FILE__, function () {
    $caps = array('read' => true, 'upload_files' => true, 'edit_uid_content' => true, 'edit_published_pages' => true, 'publish_pages' => true);
    foreach (array('edit_evenements', 'edit_others_evenements', 'publish_evenements', 'read_private_evenements', 'delete_evenements', 'delete_private_evenements', 'delete_published_evenements', 'delete_others_evenements', 'edit_private_evenements', 'edit_published_evenements') as $cap) {
        $caps[$cap] = true;
        $admin = get_role('administrator'); if ($admin) { $admin->add_cap($cap); }
    }
    $role = get_role('uid_editor');
    if (!$role) { $role = add_role('uid_editor', 'Responsable UID', $caps); }
    foreach ($caps as $cap => $enabled) { $role->add_cap($cap, $enabled); }
});
add_filter('map_meta_cap', function ($caps, $cap, $user_id, $args) {
    if (in_array($cap, array('edit_post', 'read_post'), true) && isset($args[0]) && in_array((int) $args[0], uid_page_ids(), true)) {
        $user = get_userdata($user_id);
        if ($user && in_array('uid_editor', $user->roles, true)) { return array('edit_uid_content'); }
    }
    return $caps;
}, 10, 4);
add_action('admin_menu', function () {
    add_menu_page('Site UID', 'Site UID', 'read', 'uid-status', function () {
        if (!current_user_can('edit_uid_content') && !current_user_can('manage_options')) { return; }
        echo '<div class="wrap"><h1>Site UID</h1><p>Les changements sont publiés automatiquement après reconstruction (quelques minutes).</p>';
        foreach (uid_page_ids() as $id) { echo '<p><a href="' . esc_url(get_edit_post_link($id)) . '">' . esc_html(get_the_title($id)) . '</a></p>'; }
        $dir = uid_state_dir();
        if (!$dir) { echo '<p>Reconstruction non configurée : contactez l’administrateur.</p>'; }
        else {
            $status = is_file($dir . '/status.json') ? json_decode(file_get_contents($dir . '/status.json'), true) : array();
            echo '<p>Dernière publication : ' . esc_html($status['lastSuccess'] ?? 'aucune') . '</p>';
            echo '<p>État : ' . esc_html($status['state'] ?? 'en attente') . '</p>';
            if (!empty($status['error'])) { echo '<p>Erreur : ' . esc_html($status['error']) . '</p>'; }
            echo '<p>Modifications en attente : ' . count(glob($dir . '/pending-*.json')) . '</p>';
        }
        echo '</div>';
    }, 'dashicons-megaphone');
});
add_action('admin_notices', function () {
    if (!current_user_can('manage_options')) { return; }
    if (!function_exists('acf_add_local_field_group') || !post_type_exists('evenements') || count(uid_page_ids()) !== 3 || !uid_state_dir()) {
        echo '<div class="notice notice-warning"><p>UID : vérifier ACF, le CPT evenements, les trois IDs de pages et UID_STATE_DIR avant mise en production.</p></div>';
    }
});
