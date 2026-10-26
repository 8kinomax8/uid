# Exploitation du site UID : Astro, WordPress et Plesk

## Ce qui est fourni et ce qui reste à configurer

Le dépôt fournit le client REST, les composants Astro, l’extension `wordpress/uid-headless`, l’export `wordpress/cpt-ui.json`, le script de publication et les tests. Il ne contient aucun événement de démonstration destiné à la production. L’intégration n’installe rien automatiquement sur le WordPress existant et ne change aucune redirection.

**Avant toute mise en production**, un administrateur doit vérifier les prérequis ci-dessous, installer/configurer WordPress et Plesk et réaliser la recette en préproduction. Les chemins et IDs des exemples sont à remplacer ; ce ne sont pas des valeurs découvertes sur le serveur.

## 1. Vérifier l’hébergement

Dans le panneau Plesk habituel (port 8433 indiqué par le propriétaire), relever :

- serveur Linux, racine documentaire réelle et utilisateur système de l’abonnement ;
- extension Git, accès au dépôt privé GitHub par clé SSH de déploiement **en lecture seule** ;
- Node >= 22.23.4 compatible avec Astro 7 (Node 24 LTS conseillé), `npm`, `git`, `tar` exécutables par le même utilisateur ;
- exécution des actions Git et d’une tâche planifiée chaque minute ; vérifier le contexte chroot et les chemins visibles ;
- PHP et WordPress maintenus, CPT UI et ACF gratuit disponibles ;
- écriture par PHP et le worker dans le même répertoire privé, sans permissions 777 ;
- accès HTTP du serveur à `/wordpress/wp-json/wp/v2/`, sans authentification pour les contenus publiés ;
- origine exacte de la redirection `/` → `/wordpress/` : réglages Plesk, nginx, Apache `.htaccess` ou extension WordPress ;
- certificat HTTPS valide pour le site et le webhook Plesk.

Si un prérequis manque, arrêter la configuration de l’automatisation et faire adapter l’hébergement. Ne pas publier les sources dans `httpdocs` pour contourner une restriction chroot. Ne pas remplacer le webhook HTTPS par HTTP.

Sauvegarder la base WordPress, tous les fichiers existants, les réglages Plesk/nginx/Apache et les redirections. Vérifier une restauration avant la bascule. Conserver WordPress et son URL `/wordpress/`.

## 2. Configurer WordPress

1. Installer et activer **Custom Post Type UI** et **Advanced Custom Fields gratuit**. Ne pas installer ACF Pro, de page builder ou de plugin de synchronisation Google.
2. Dans CPT UI → Outils → Importer les types de contenus, importer `wordpress/cpt-ui.json`. Si un type `evenements` existe déjà, comparer sa configuration et ses données avant import. Vérifier le slug REST `evenements`, les supports titre/image mise en avant/champs personnalisés et les capacités `evenement,evenements`.
3. Créer trois pages administratives dédiées : « Session découverte — Lutins », « Session découverte — Aventuriers » et « Configuration — Agenda ». Les laisser en brouillon jusqu’à l’installation de l’extension. Relever leurs IDs dans l’URL d’édition. Elles servent de fiches de données, pas de pages Astro.
4. Créer des répertoires privés sous l’abonnement, en dehors de la racine documentaire : `private/uid/state`, `private/uid/releases`, `private/uid/tools`. PHP et le worker doivent utiliser le même utilisateur système (fichiers de file en 0600) ; répertoires 0700. Si les utilisateurs diffèrent, faire exécuter la tâche sous l’utilisateur PHP ; sinon suspendre la configuration et adapter explicitement la stratégie de permissions avant utilisation.
5. Ajouter dans `wp-config.php`, avant la ligne de fin, les valeurs réelles :

```php
define('UID_DOCUMENT_ROOT', '/var/www/vhosts/fanfareuid.ch/httpdocs');
define('UID_STATE_DIR', '/var/www/vhosts/fanfareuid.ch/private/uid/state');
define('UID_LUTINS_PAGE_ID', 123);
define('UID_AVENTURIERS_PAGE_ID', 124);
define('UID_CALENDAR_PAGE_ID', 125);
```

6. Copier uniquement `wordpress/uid-headless/` dans `wordpress/wp-content/plugins/uid-headless/`, puis activer **UID Headless**. Le JSON ACF inclus est chargé automatiquement par l’extension : **ne pas l’importer aussi dans ACF**, cela créerait une seconde définition. Les règles d’emplacement sont calculées à partir des IDs. L’export reste lisible et importable si une migration manuelle est nécessaire, après adaptation des IDs et désactivation des définitions automatiques.
7. Régler le fuseau WordPress sur **Europe/Zurich**, pas sur un décalage UTC fixe. Ouvrir les trois fiches, enregistrer les deux sessions désactivées et le calendrier vide ou configuré, puis les publier. Leur contenu doit être public pour la lecture REST ; ne pas y stocker de données privées.
8. Créer les comptes responsables avec le rôle **Responsable UID**. Le menu « Site UID » donne accès aux trois fiches et au statut de publication. Le rôle peut gérer les événements et envoyer des médias, mais ne reçoit pas l’édition générale des pages, la gestion des extensions ou celle des utilisateurs. Vérifier ces droits avec un compte réel de recette.
9. Vérifier les API ci-dessous dans une fenêtre non connectée. Le groupe ACF doit être exposé ; le JSON fourni active `show_in_rest`.

```text
/wordpress/wp-json/wp/v2/evenements?per_page=100&page=1
/wordpress/wp-json/wp/v2/pages/123
/wordpress/wp-json/wp/v2/pages/124
/wordpress/wp-json/wp/v2/pages/125
/wordpress/wp-json/wp/v2/media/ID
```

Le CPT conserve l’accès REST public mais pas de pages publiques d’événements dans le thème WordPress. Les pages de configuration peuvent encore être visibles dans l’ancien thème pendant la transition : les exclure des menus. Après bascule, appliquer `X-Robots-Tag: noindex` aux réponses sous `/wordpress/` via la configuration serveur, sans bloquer l’API ni les médias. Ne pas activer aveuglément l’option WordPress « décourager les moteurs », qui pourrait affecter le robots.txt du domaine.

### Champs et formats

| Fiche | Champs |
| --- | --- |
| Événement | titre natif, image mise en avant native, `description` (texte), `date_heure` (`Y-m-d H:i:s` suisse), `lieu`, `lien_externe` facultatif |
| Galerie | `meta.uid_gallery_ids`, liste d’IDs d’images ordonnée ; boutons ajouter/retirer/monter/descendre dans la fiche |
| Session | `session_active`, `session_affiche` (ID média), `session_date` (ACF stocke `Ymd`), `session_heure_debut` et `session_heure_fin` (`H:i:s`), `session_inscription_url`, `session_description` facultative |
| Agenda | `google_calendar_id`, identifiant public Google, pas le code iframe ni une URL secrète iCal |

Le client accepte la date de session ACF brute `Ymd` et sa forme formatée `Y-m-d`. Un horaire inexistant lors du passage à l’heure d’été est refusé ; lors de l’heure répétée en automne, la première occurrence est retenue. Un événement reste affiché jusqu’à la fin de sa journée suisse. Les sessions restent visibles tant que leur case est activée : pas de désactivation implicite par date.

L’image principale est obligatoire pour un événement publié. Les autres photos restent facultatives. Renseigner les textes alternatifs dans la médiathèque. Les images sont conservées dans `wp-content/uploads/`. Préférer des fichiers déjà dimensionnés/compressés pour le web : ils ne sont pas téléchargés dans `dist`.

Les fiches invalides sont bloquées dans le formulaire ACF ou par la REST API. Une publication via édition rapide ou code contournant ce formulaire est rabattue en brouillon si les champs requis sont invalides. Les descriptions sont rendues en texte échappé, pas en HTML libre.

Ne recopier les anciennes sessions ou cartes de démonstration qu’après validation éditoriale. Les contacts généraux et textes fixes restent dans Astro. Les anciennes dates des sessions ne sont plus utilisées comme secours.

### Google Calendar

Dans Google Calendar, sélectionner le calendrier destiné au public, rendre **ce calendrier** public et copier son identifiant dans « Intégrer l’agenda ». Vérifier son affichage en navigation privée avant de le mettre dans WordPress. Ne pas rendre public un agenda interne.

L’agenda affiche Google dans une iframe et conserve un lien d’ouverture externe utilisable si l’intégration est bloquée. Google gère les rendez-vous d’Agenda ; WordPress gère les cartes de l’accueil. Aucun événement n’est copié automatiquement d’une source à l’autre. Le chargement de l’iframe contacte Google ; intégrer ce fonctionnement dans l’information de confidentialité du site avant lancement. Une modification de rendez-vous Google ne nécessite pas de build Astro ; un changement d’identifiant de calendrier en nécessite un.

## 3. Configurer le build et la publication Plesk

### Répertoires et configuration

Configurer le dépôt Git distant GitHub dans Plesk. La cible de checkout doit être **hors `httpdocs`**, par exemple `private/uid/checkout`. Relever également le chemin du véritable dépôt Git créé par Plesk : c’est ce chemin (bare ou non) qu’utilise `repository` dans la configuration, et non un dossier sans `.git`.

Copier `deploy/uid-deploy.mjs` dans `private/uid/tools/`. Le lanceur est installé explicitement et reste stable ; une future mise à jour du lanceur doit être vérifiée puis recopiée séparément du déploiement du site.

Copier `deploy/config.example.json` vers `private/uid/config.json`, permissions 0600. Remplacer tous les chemins, la référence Git déployée, le binaire npm et les IDs WordPress. Les chemins doivent exister et être disjoints de la racine publique. Pour un clone Plesk, vérifier la référence avec `git show-ref` plutôt que supposer `refs/heads/main`.

Le PATH des actions et des tâches doit contenir **le même Node que npm**, ainsi que `git` et `tar`. Exemple à adapter au Node installé :

```sh
export PATH=/opt/plesk/node/24/bin:/usr/local/bin:/usr/bin:/bin
node /var/www/vhosts/fanfareuid.ch/private/uid/tools/uid-deploy.mjs check /var/www/vhosts/fanfareuid.ch/private/uid/config.json
```

Le mode `check` ne publie rien. Il contrôle les chemins, les exécutables, la version de Node, les permissions et la référence Git. Il ne peut pas vérifier à lui seul les réglages du panneau, le cron, les sauvegardes ou la redirection.

Pour le développement local, copier `astro/.env.example` en `astro/.env` et renseigner les valeurs de la préproduction. Un build sans configuration échoue volontairement. Aucun mode de démonstration ne permet de publier silencieusement des contenus inventés.

### GitHub → Plesk

Activer le déploiement automatique du checkout privé et ajouter l’action suivante dans les actions de déploiement Plesk, avec les chemins réels :

```sh
export PATH=/opt/plesk/node/24/bin:/usr/local/bin:/usr/bin:/bin
node /var/www/vhosts/fanfareuid.ch/private/uid/tools/uid-deploy.mjs git /var/www/vhosts/fanfareuid.ch/private/uid/config.json
```

Dans GitHub → Settings → Webhooks, ajouter **l’URL HTTPS générée par Plesk**, événement `push`, puis vérifier la réception côté Plesk. Traiter cette URL comme une capacité privée ; ne pas la committer. Seule la référence Git configurée est construite.

Commiter et pousser les changements relus avant le premier déploiement : le lanceur ignore volontairement les modifications non commitées.

Le lanceur archive le commit dans un répertoire isolé, exécute `npm ci` puis `npm run build`, valide `dist` et publie les assets avant le HTML. Les sources, dépendances, journaux et secrets ne sont jamais copiés dans la racine publique. Chaque commande de construction est limitée à quinze minutes ; une construction échouée est nettoyée et ses signaux restent en attente. Il refuse les collisions avec des fichiers qu’il ne gère pas, les liens symboliques et toute destination sous `wordpress/`.

**Premier déploiement :** si `index.html` ou d’autres destinations Astro existent déjà, ne pas désactiver cette protection. Les inventorier, les sauvegarder hors web et déplacer uniquement les fichiers explicitement remplacés. Ne pas toucher à `wordpress/`, à `.htaccess`, à `index.php` ni aux autres fichiers inconnus. Vérifier l’ordre `DirectoryIndex` nginx/Apache pour que `index.html` serve Astro sans supprimer `index.php`.

### WordPress → reconstruction locale

Créer une tâche Plesk chaque minute, sous le même utilisateur :

```sh
export PATH=/opt/plesk/node/24/bin:/usr/local/bin:/usr/bin:/bin
node /var/www/vhosts/fanfareuid.ch/private/uid/tools/uid-deploy.mjs worker /var/www/vhosts/fanfareuid.ch/private/uid/config.json
```

Configurer Plesk pour notifier l’administrateur en cas d’échec de tâche. Les sorties peuvent être dirigées vers un journal **privé** avec rotation. Le statut synthétique est aussi visible dans « Site UID ».

L’extension crée des marqueurs après sauvegarde complète, y compris pour les suppressions, changements de statut et modifications de médias. Le worker regroupe les marqueurs présents au démarrage. Il n’efface aucun signal arrivé pendant le build et ne les acquitte pas après un échec. Les modifications de médias peuvent déclencher un build même si le média n’est pas utilisé, par prudence.

Git et WordPress partagent un verrou. Un push arrivé pendant un build est conservé dans la file Git. Sans push en attente, une reconstruction de contenu repart du dernier commit publié, pas de fichiers du checkout éventuellement modifiés. Le premier lancement doit être explicite en mode `git` ; le worker ne publie jamais seul une première version.

Le worker reconstruit aussi lors du premier passage de chaque journée suisse pour retirer les événements passés. Délai habituel : une minute plus la durée du build ; aucun délai maximal n’est garanti si WordPress ou le serveur est indisponible.

## 4. Recette et bascule

Préproduction protégée, avec copie séparée de WordPress et répertoires de déploiement séparés :

- créer/modifier/supprimer/dépublier un événement, remplacer son image, ordonner sa galerie ;
- vérifier toutes les pages REST au-delà de 100 événements, les événements du jour et leur retrait le lendemain ;
- activer/désactiver chaque session indépendamment, vérifier l’absence de bloc vide et la présence du contact Aventuriers ;
- vérifier agenda public, lien externe, état agenda vide et blocage de l’iframe ;
- tester au clavier la lightbox et la navigation, mobile, thèmes clair/sombre et réduction des animations ;
- provoquer une panne REST et vérifier que les pages publiées ne changent pas ;
- enregistrer une modification pendant un build et pousser un commit pendant celui-ci : vérifier le passage suivant ;
- vérifier les comptes Responsable UID et leur absence d’accès aux autres pages/réglages ;
- tester restauration et absence d’accès web à `.git`, `node_modules`, sources, configuration et journaux.

Avant bascule, sauvegarder à nouveau WordPress et les réglages. Publier Astro, vérifier les fichiers et l’API, puis retirer **uniquement** la règle identifiée qui redirige la racine vers `/wordpress/`. Vérifier `/`, `/agenda/`, les pages jeunesse, les médias et `/wordpress/wp-admin/`. Conserver les règles WordPress dans son sous-dossier et les règles serveur non liées à l’ancienne redirection.

## 5. Rollback et incidents

Les trois dernières versions publiées sont conservées. Le fichier privé `state/current.json` contient leurs IDs dans `history`. Pour revenir à une version :

```sh
node /var/www/vhosts/fanfareuid.ch/private/uid/tools/uid-deploy.mjs rollback /var/www/vhosts/fanfareuid.ch/private/uid/config.json ID_VERSION
```

Le rollback conserve les signaux de contenu en attente : le worker les reconstruira sur le commit restauré. Pour geler exactement une ancienne version pendant un incident, suspendre temporairement la tâche et les actions Git dans Plesk avant le rollback. Réactiver après résolution. Les photos restent des URLs WordPress : le rollback Astro ne restaure pas un média supprimé ; utiliser la sauvegarde WordPress pour cela.

La publication utilise un journal de transaction privé et une copie de sauvegarde des fichiers gérés. En cas d’erreur détectée, elle restaure les fichiers précédents. Elle n’est pas un échange atomique de toute la racine : des requêtes peuvent traverser brièvement deux générations de HTML, mais les anciens assets hachés sont conservés avec les versions récentes.

Après arrêt brutal du processus, le verrou reste volontairement en place. Vérifier dans `state/deploy.lock/owner.json` le PID et l’heure, confirmer que **plus aucun déploiement n’est actif**, puis retirer seulement ce répertoire de verrou. Ne jamais supprimer `state/transaction` : le lancement suivant l’utilise pour restaurer la version précédente avant de reprendre. Une récupération échouée nécessite l’intervention de l’administrateur ; ne pas effacer le journal.

Pour rétablir l’ancien site, suspendre les deux déclencheurs, rétablir la redirection sauvegardée vers `/wordpress/` et vérifier WordPress. Ne supprimer aucun fichier WordPress pour revenir en arrière.

## 6. Commandes de validation du dépôt

Depuis `astro/` :

```sh
npm ci
npm run check
npm test
npm run test:build
```

Les tests TypeScript utilisent Node >=22.23.4 avec `--experimental-strip-types` ; les tests de build ouvrent une API simulée uniquement sur localhost et génèrent leurs sorties dans un répertoire temporaire supprimé en fin de test. Ces contenus ne sont jamais exportés dans `astro/dist`.

Sur un environnement PHP disposant de WordPress :

```sh
php -l wordpress/uid-headless/uid-headless.php
```

Le lint PHP ne remplace pas la recette WordPress/ACF/CPT UI réelle. L’import de configuration, les droits des comptes, les hooks de sauvegarde et les tâches Plesk doivent être vérifiés sur la préproduction.

Références : [ACF et REST](https://www.advancedcustomfields.com/resources/wp-rest-api-integration/), [pagination WordPress](https://developer.wordpress.org/rest-api/using-the-rest-api/pagination/), [Git distant Plesk](https://docs.plesk.com/en-US/obsidian/customer-guide/git-support/using-remote-git-hosting.75848/), [Google Calendar intégré](https://support.google.com/calendar/answer/41207?hl=fr).
