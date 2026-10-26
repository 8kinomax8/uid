<?php
/** DEV-only GitHub Actions outbox. Included by uid-headless.php. */
if (!defined('ABSPATH')) { exit; }

function uid_deploy_is_dev() {
    return defined('UID_DEPLOY_ENVIRONMENT') && UID_DEPLOY_ENVIRONMENT === 'development'
        && strtolower((string) wp_parse_url(site_url(), PHP_URL_HOST)) === 'dev.fanfareuid.ch'
        && wp_parse_url(site_url(), PHP_URL_SCHEME) === 'https';
}
function uid_deploy_secret() {
    return defined('UID_CMS_HMAC_SECRET') && preg_match('/^[a-f0-9]{64}$/', UID_CMS_HMAC_SECRET) ? UID_CMS_HMAC_SECRET : false;
}
function uid_deploy_write($file, $value) {
    $temp = $file . '.' . wp_generate_uuid4() . '.tmp';
    if (file_put_contents($temp, wp_json_encode($value), LOCK_EX) === false) { throw new RuntimeException('UID: impossible d’écrire la file privée.'); }
    chmod($temp, 0600);
    if (!rename($temp, $file)) { @unlink($temp); throw new RuntimeException('UID: impossible de valider la file privée.'); }
}
function uid_deploy_status($updates) {
    $dir = uid_state_dir();
    if (!$dir) { throw new RuntimeException('UID: répertoire privé non configuré.'); }
    $file = $dir . '/deployment-status.json';
    $previous = is_file($file) ? json_decode(file_get_contents($file), true) : array();
    $status = array_merge(is_array($previous) ? $previous : array(), $updates);
    uid_deploy_write($file, $status);
    return $status;
}
function uid_deploy_pending() {
    $dir = uid_state_dir();
    return $dir ? array_values(array_filter(glob($dir . '/pending-*.json'), function ($file) { return is_file($file) && !is_link($file); })) : array();
}
add_filter('cron_schedules', function ($schedules) {
    $schedules['uid_minute'] = array('interval' => 60, 'display' => 'UID — chaque minute');
    return $schedules;
});
add_action('init', function () {
    if (uid_deploy_is_dev() && !wp_next_scheduled('uid_dispatch_outbox')) { wp_schedule_event(time() + 60, 'uid_minute', 'uid_dispatch_outbox'); }
});
register_deactivation_hook(__DIR__ . '/uid-headless.php', function () { wp_clear_scheduled_hook('uid_dispatch_outbox'); });

function uid_dispatch_outbox() {
    if (!uid_deploy_is_dev() || !defined('UID_GITHUB_DEPLOY_ENABLED') || UID_GITHUB_DEPLOY_ENABLED !== true) { return; }
    $dir = uid_state_dir();
    if (!$dir || !uid_deploy_secret() || !defined('UID_GITHUB_TOKEN') || !UID_GITHUB_TOKEN || !uid_deploy_pending()) { return; }
    $lock = fopen($dir . '/github-dispatch.lock', 'c');
    if (!$lock) { return; }
    chmod($dir . '/github-dispatch.lock', 0600);
    if (!flock($lock, LOCK_EX | LOCK_NB)) { fclose($lock); return; }
    try {
        $file = $dir . '/deployment-status.json';
        $status = is_file($file) ? json_decode(file_get_contents($file), true) : array();
        if (is_array($status) && ($status['nextAttempt'] ?? 0) > time()) { return; }
        // Persist a lease before the network call. A killed PHP request is retried later.
        uid_deploy_status(array('state' => 'demande GitHub en cours', 'nextAttempt' => time() + 120));
        $response = wp_remote_post('https://api.github.com/repos/8kinomax8/uid/actions/workflows/uid-dev.yml/dispatches', array(
            'timeout' => 20, 'redirection' => 0,
            'headers' => array('Authorization' => 'Bearer ' . UID_GITHUB_TOKEN, 'Accept' => 'application/vnd.github+json', 'X-GitHub-Api-Version' => '2022-11-28', 'Content-Type' => 'application/json'),
            'body' => wp_json_encode(array('ref' => 'main', 'inputs' => array('action' => 'deploy', 'source' => 'wordpress', 'first_deployment' => 'false'))),
        ));
        $code = is_wp_error($response) ? 0 : wp_remote_retrieve_response_code($response);
        if (in_array($code, array(200, 204), true)) {
            uid_deploy_status(array('state' => 'en attente de GitHub Actions', 'lastDispatch' => gmdate('c'), 'nextAttempt' => time() + 1800, 'failures' => 0, 'error' => null));
        } else {
            $failures = min(5, (int) ($status['failures'] ?? 0) + 1);
            uid_deploy_status(array('state' => 'erreur de déclenchement', 'failures' => $failures, 'nextAttempt' => time() + min(900, 60 * (2 ** $failures)), 'error' => 'GitHub indisponible ou autorisation refusée (HTTP ' . (int) $code . '). Les modifications restent en attente.'));
        }
    } catch (Exception $error) {
        error_log('UID: erreur de file de reconstruction GitHub.');
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
add_action('uid_dispatch_outbox', 'uid_dispatch_outbox');

function uid_deploy_authorize($request) {
    $dir = uid_state_dir();
    $secret = uid_deploy_secret();
    if (!uid_deploy_is_dev() || !$dir || !$secret) { return new WP_Error('uid_disabled', 'Déploiement DEV non configuré.', array('status' => 503)); }
    $stamp = $request->get_header('x-uid-time');
    $nonce = $request->get_header('x-uid-nonce');
    $signature = $request->get_header('x-uid-signature');
    if (!preg_match('/^[0-9]{10}$/', $stamp) || abs(time() - (int) $stamp) > 300 || !preg_match('/^[a-f0-9]{32}$/', $nonce) || !preg_match('/^[a-f0-9]{64}$/', $signature) || strlen($request->get_body()) > 2048) {
        return new WP_Error('uid_auth', 'Signature invalide.', array('status' => 403));
    }
    $expected = hash_hmac('sha256', $stamp . "\n" . $nonce . "\n" . $request->get_body(), $secret);
    if (!hash_equals($expected, $signature)) { return new WP_Error('uid_auth', 'Signature invalide.', array('status' => 403)); }
    // Atomic exclusive creation prevents replay, including parallel requests.
    $nonce_file = $dir . '/nonce-' . $nonce;
    $handle = @fopen($nonce_file, 'x');
    if (!$handle) { return new WP_Error('uid_replay', 'Requête déjà utilisée.', array('status' => 409)); }
    fclose($handle); chmod($nonce_file, 0600);
    foreach (glob($dir . '/nonce-*') as $file) { if (!is_link($file) && filemtime($file) < time() - 600) { @unlink($file); } }
    return true;
}
function uid_deploy_request($request) {
    $dir = uid_state_dir();
    $data = $request->get_json_params();
    if (!is_array($data) || !isset($data['operation']) || !in_array($data['operation'], array('snapshot', 'ack', 'fail'), true) || !preg_match('/^[0-9]+$/', (string) ($data['run'] ?? ''))) {
        return new WP_Error('uid_payload', 'Requête invalide.', array('status' => 400));
    }
    $lock = fopen($dir . '/github-dispatch.lock', 'c');
    if (!$lock) { return new WP_Error('uid_lock', 'File indisponible.', array('status' => 503)); }
    chmod($dir . '/github-dispatch.lock', 0600);
    if (!flock($lock, LOCK_EX)) { fclose($lock); return new WP_Error('uid_lock', 'File indisponible.', array('status' => 503)); }
    try {
        if ($data['operation'] === 'snapshot') {
            $token = wp_generate_uuid4();
            $snapshot = array('token' => $token, 'run' => (string) $data['run'], 'markers' => array_map('basename', uid_deploy_pending()), 'acknowledged' => false);
            uid_deploy_write($dir . '/snapshot-' . $token . '.json', $snapshot);
            uid_deploy_status(array('state' => 'reconstruction GitHub', 'nextAttempt' => time() + 1800, 'error' => null));
            return array('token' => $token);
        }
        if (!preg_match('/^[a-f0-9-]{36}$/', (string) ($data['token'] ?? ''))) { return new WP_Error('uid_token', 'Snapshot invalide.', array('status' => 400)); }
        $file = $dir . '/snapshot-' . $data['token'] . '.json';
        if (!is_file($file) || is_link($file)) { return new WP_Error('uid_token', 'Snapshot absent.', array('status' => 404)); }
        $snapshot = json_decode(file_get_contents($file), true);
        if (!is_array($snapshot) || ($snapshot['run'] ?? '') !== (string) $data['run']) { return new WP_Error('uid_run', 'Exécution différente.', array('status' => 403)); }
        if ($data['operation'] === 'ack') {
            if (!$snapshot['acknowledged']) {
                foreach ($snapshot['markers'] as $marker) {
                    if (!preg_match('/^pending-[a-f0-9-]{36}\.json$/', $marker)) { throw new RuntimeException('Invalid saved marker'); }
                    $target = $dir . '/' . $marker;
                    if (is_file($target) && !is_link($target) && !unlink($target)) { throw new RuntimeException('Cannot acknowledge marker'); }
                }
                $snapshot['acknowledged'] = true;
                uid_deploy_write($file, $snapshot);
            }
            uid_deploy_status(array('state' => 'DEV publié', 'lastSuccess' => gmdate('c'), 'run' => (string) $data['run'], 'nextAttempt' => time() + 60, 'error' => null, 'failures' => 0));
        } elseif (!$snapshot['acknowledged']) {
            uid_deploy_status(array('state' => 'échec GitHub Actions', 'nextAttempt' => time() + 120, 'error' => 'La publication a échoué. Consultez GitHub Actions ; les changements restent en attente.'));
        }
        // Old snapshots are disposable; pending markers are never pruned by age.
        foreach (glob($dir . '/snapshot-*.json') as $old) { if (!is_link($old) && filemtime($old) < time() - 7 * DAY_IN_SECONDS) { @unlink($old); } }
        return array('ok' => true);
    } catch (Exception $error) {
        return new WP_Error('uid_storage', 'Erreur de stockage privé.', array('status' => 503));
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
add_action('rest_api_init', function () {
    register_rest_route('uid-headless/v1', '/deployment', array('methods' => 'POST', 'permission_callback' => 'uid_deploy_authorize', 'callback' => 'uid_deploy_request'));
});
