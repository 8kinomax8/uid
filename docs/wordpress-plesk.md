# UID DEV — GitHub Actions, WordPress headless et Plesk

Le build Astro est effectué sur GitHub Actions avec **Node.js 24**. Plesk reçoit uniquement les fichiers statiques et les publie avec Bash. Aucun Node, npm ou dépôt Git n’est nécessaire sur Plesk. Le frontend Astro/GSAP, les CPT et les champs ACF sont conservés.

**Aucun déploiement n’a été exécuté par cette modification.** Le workflow est livré avec les automatismes désactivés par défaut. Le premier déploiement nécessite une action manuelle explicite après validation.

## 1. Paramètres DEV confirmés

| Paramètre | Valeur |
| --- | --- |
| Dépôt / branche | `8kinomax8/uid` / `main` |
| Frontend | `https://dev.fanfareuid.ch/` |
| WordPress | `https://dev.fanfareuid.ch/wordpress/` |
| API du build | `https://dev.fanfareuid.ch/wordpress/wp-json/wp/v2` |
| SSH | `fanfareuid@ananke.kreativmedia.ch`, port **2121** |
| Racine DEV | `/home/httpd/vhosts/fanfareuid.ch/dev.fanfareuid.ch` |
| Répertoire privé DEV | `/home/httpd/vhosts/fanfareuid.ch/private/uid-dev` |
| Bash / rsync | `/usr/bin/bash` / `/usr/bin/rsync` |
| Shell de connexion | `/bin/sh` ; le workflow appelle Bash explicitement |

Les trois **IDs de pages WordPress DEV** restent à renseigner : Lutins, Aventuriers, Agenda. Ne pas recopier les IDs de production sans les vérifier dans DEV.

Les chemins sont contrôlés dans les scripts. Changer seulement un secret ou un paramètre ne permet pas de déployer ailleurs. La racine et le répertoire privé doivent correspondre à leurs chemins physiques, sans résolution vers une autre destination par lien symbolique.

## 2. Préparer le serveur une fois, sans publier Astro

Effectuer ces étapes avec la connexion administrative existante, pas avec la future clé GitHub restreinte. Sauvegarder d’abord WordPress DEV, ses fichiers et sa base. Ne modifier aucun réglage du domaine de production.

1. Supprimer/désactiver les **anciens déclencheurs de build Node Plesk** : action Git `uid-deploy.mjs`, tâche `worker` Node et ancien webhook GitHub → Plesk. Les nouveaux scripts ne les utilisent plus. Ne pas supprimer WordPress ni les sauvegardes existantes.
2. Créer les répertoires privés ci-dessous avec accès limité à l’utilisateur `fanfareuid` et au PHP de WordPress DEV. PHP et SSH doivent pouvoir partager `cms-state` ; vérifier les utilisateurs réellement utilisés avant de régler les permissions. Ne pas utiliser 777.

```text
/home/httpd/vhosts/fanfareuid.ch/private/uid-dev/
├── bin/                  # scripts installés manuellement
├── incoming/             # staging rsync, jamais une racine web
├── releases/             # trois versions statiques publiées
├── state/                # manifeste, historique, initialisation
├── cms-state/            # file WordPress, signatures et statut GitHub
└── server.env            # configuration privée
```

Si l’ancienne configuration WordPress possède déjà des fichiers `pending-*.json`, les copier du précédent répertoire privé vers `cms-state` avant activation, sans les acquitter. Ne pas recopier l’ancien état Node (`current.json`, historique et verrous) dans le nouvel état Bash.

3. Copier par SFTP `deploy/uid-publish.sh` et `deploy/uid-ssh-gate.sh` dans `bin/`, puis `deploy/server.dev.example.env` vers `server.env`. Répertoires 0700, configuration et scripts 0600 conviennent : Bash est invoqué explicitement. Vérifier que les droits du PHP DEV permettent son accès à `cms-state` (fichiers en 0600).
4. Dans **la racine DEV confirmée uniquement**, créer le petit fichier d’attestation `.uid-dev-target` contenant exactement `dev.fanfareuid.ch`. Ce fichier ne sera pas modifié par la publication. Ne jamais le créer dans la racine de production.
5. Vérifier la configuration en lecture seule :

```sh
/usr/bin/bash /home/httpd/vhosts/fanfareuid.ch/private/uid-dev/bin/uid-publish.sh \
  /home/httpd/vhosts/fanfareuid.ch/private/uid-dev/server.env check
```

Ce contrôle ne publie rien et ne marque pas le site comme initialisé. Vérifier aussi la présence de `sha256sum` ou `shasum`, et des utilitaires usuels `awk`, `find`, `sort`, `cp`, `mv`, `mktemp`. Les scripts n’utilisent pas PHP CLI sur Plesk.

### Clé SSH dédiée à GitHub

Générer localement une nouvelle clé Ed25519 dédiée au DEV, sans réutiliser une clé de production. Conserver la clé privée dans le secret GitHub décrit plus bas.

Ajouter **uniquement sa clé publique** dans `~fanfareuid/.ssh/authorized_keys`, précédée de cette restriction (une seule ligne) :

```text
command="/usr/bin/bash /home/httpd/vhosts/fanfareuid.ch/private/uid-dev/bin/uid-ssh-gate.sh",no-agent-forwarding,no-port-forwarding,no-X11-forwarding,no-pty ssh-ed25519 CLE_PUBLIQUE uid-github-dev
```

Le garde autorise seulement le script DEV et le récepteur rsync dans `incoming/`. Il refuse le shell général, les transferts vers la racine web, les options de suppression et le suivi des répertoires symboliques. Ne pas placer cette restriction sur la clé administrative existante.

Obtenir l’empreinte de la clé hôte SSH via une source de confiance (hébergeur ou connexion déjà vérifiée). Un `ssh-keyscan -p 2121 ananke.kreativmedia.ch` peut collecter la clé, mais **ne prouve pas son authenticité** : comparer son empreinte avant de l’utiliser. La ligne `known_hosts` doit identifier `[ananke.kreativmedia.ch]:2121`. Le workflow impose `StrictHostKeyChecking=yes` et n’accepte pas automatiquement une nouvelle clé.

## 3. Configurer WordPress DEV

Conserver CPT UI, ACF gratuit, le CPT `evenements` et les deux fiches de sessions. L’API DEV et les champs ACF sont déjà opérationnels d’après les vérifications du propriétaire. Mettre à jour le dossier `wordpress/uid-headless/` **sur DEV uniquement**, en incluant le nouveau fichier `deployment.php`.

Configurer `wp-config.php` **DEV uniquement**, avant la ligne de fin :

```php
define('UID_DOCUMENT_ROOT', '/home/httpd/vhosts/fanfareuid.ch/dev.fanfareuid.ch');
define('UID_STATE_DIR', '/home/httpd/vhosts/fanfareuid.ch/private/uid-dev/cms-state');
define('UID_DEPLOY_ENVIRONMENT', 'development');
define('UID_LUTINS_PAGE_ID', ID_PAGE_DEV_LUTINS);
define('UID_AVENTURIERS_PAGE_ID', ID_PAGE_DEV_AVENTURIERS);
define('UID_CALENDAR_PAGE_ID', ID_PAGE_DEV_AGENDA);
define('UID_CMS_HMAC_SECRET', 'SECRET_HEXADECIMAL_DE_64_CARACTERES');
define('UID_GITHUB_TOKEN', 'JETON_GITHUB_DEDIE');
define('UID_GITHUB_DEPLOY_ENABLED', false); // garder false jusqu’après le premier déploiement validé
```

Les valeurs `ID_PAGE_...` et les secrets sont des paramètres à remplacer, pas des valeurs exécutables à copier telles quelles. Générer le secret HMAC avec `openssl rand -hex 32`. Mettre exactement le même secret dans GitHub. Ne committer aucun secret et ne les stocker ni dans les champs ACF ni dans le navigateur.

Créer un **fine-grained personal access token** GitHub limité au dépôt `8kinomax8/uid`, permission **Actions: write**, avec date d’expiration. Ce jeton est conservé seulement dans `wp-config.php` DEV ; il permet de demander le workflow `uid-dev.yml` sur `main`. Planifier sa rotation avant expiration. Les jetons classiques au scope global `repo` ne sont pas nécessaires.

### Déclenchement fiable et acquittement

- Une sauvegarde terminée, une dépublication, une suppression ou un changement de média crée un marqueur persistant dans `cms-state`.
- Une tâche WordPress chaque minute regroupe ces changements et appelle l’API `workflow_dispatch` de GitHub en HTTPS, sans suivre les redirections.
- Une acceptation par GitHub **n’efface pas** les modifications. Avant le build, Actions prend un snapshot signé des marqueurs ; après une publication réussie seulement, il acquitte ce snapshot.
- Les modifications arrivées pendant le build restent en attente. Les échecs HTTP sont réessayés avec un délai croissant. Une demande acceptée mais sans succès confirmé est réessayée après 30 minutes, y compris si un run a été annulé.
- Les appels snapshot/ack/fail utilisent HMAC-SHA256, un timestamp limité à cinq minutes, un nonce à usage unique et un token de snapshot lié au run. Aucune clé GitHub ou SSH n’est exposée dans cet endpoint.
- Le menu « Site UID » affiche le dernier succès, les erreurs et le nombre de modifications en attente. Une copie de l’extension sur un WordPress de production ne peut pas déclencher DEV : le domaine DEV et l’environnement sont vérifiés.

**Ne pas dépendre des visites pour WP-Cron.** Dans les tâches planifiées Plesk DEV, choisir une récupération d’URL chaque minute vers :

```text
https://dev.fanfareuid.ch/wordpress/wp-cron.php
```

Vérifier l’exécution réelle et les éventuelles protections HTTP de DEV. Après ce contrôle seulement, l’option `DISABLE_WP_CRON` peut être activée si elle est souhaitée pour éviter les déclenchements par les visites. Aucun Node ou npm n’intervient. Les modifications de médias peuvent provoquer une reconstruction même si le média n’est pas utilisé, par prudence.

### Contrats de contenus conservés

| Contenu | Champs |
| --- | --- |
| Événement | titre et image mise en avant natifs ; `description`, `date_heure` (`Y-m-d H:i:s`, Europe/Zurich), `lieu`, `lien_externe` facultatif |
| Galerie | `meta.uid_gallery_ids`, IDs ordonnés via le sélecteur natif de médias |
| Session | `session_active`, `session_affiche`, `session_date`, `session_heure_debut`, `session_heure_fin`, `session_inscription_url`, `session_description` facultative |
| Agenda | `google_calendar_id` : identifiant du calendrier Google public |

Le groupe ACF est chargé par l’extension depuis `acf-fields.json` ; ne pas l’importer une seconde fois. `wordpress/cpt-ui.json` reste disponible pour une installation vierge, sans écraser une configuration existante. Les sessions désactivées ne produisent aucun bloc. Les textes fixes restent dans Astro. Tous les événements à venir sont affichés, triés selon leur date suisse, sans données fictives de secours.

## 4. Configurer GitHub

Créer l’environnement **development** dans Settings → Environments. Restreindre ses déploiements à `main` et protéger cette branche. Des reviewers obligatoires peuvent être utilisés pour la validation initiale ; s’ils restent obligatoires ensuite, chaque reconstruction attendra leur approbation.

### Secrets de l’environnement development

| Secret | Contenu |
| --- | --- |
| `DEV_SSH_PRIVATE_KEY` | Clé privée dédiée dont la clé publique est restreinte ci-dessus |
| `DEV_SSH_KNOWN_HOSTS` | Ligne(s) de clé hôte vérifiée(s) pour `[ananke.kreativmedia.ch]:2121` |
| `UID_CMS_HMAC_SECRET` | Même secret hexadécimal de 64 caractères que WordPress DEV |

Le jeton WordPress `UID_GITHUB_TOKEN` n’est pas nécessaire dans les secrets Actions.

### Variables de l’environnement development

- `DEV_WORDPRESS_LUTINS_PAGE_ID`
- `DEV_WORDPRESS_AVENTURIERS_PAGE_ID`
- `DEV_WORDPRESS_CALENDAR_PAGE_ID`

### Variable du dépôt, pas de l’environnement

`UID_DEV_AUTO_DEPLOY` : laisser absente ou `false` pendant toute la préparation. Le garde de job doit pouvoir la lire avant de charger l’environnement development. Passer à `true` seulement **après** le premier déploiement manuel validé.

L’URL de l’API, le domaine DEV, l’hôte SSH, le port, l’utilisateur et le répertoire privé sont fixés aux valeurs confirmées. Le workflow refuse les IDs manquants/dupliqués, une API de production et les redirections API. Les médias retournés par WordPress doivent aussi appartenir au domaine DEV. Si une copie de WordPress conserve des URLs de médias de production, corriger ces références sur DEV avant le build, sans assouplir ce garde. Les métadonnées canoniques du build DEV utilisent DEV avec `noindex, nofollow`.

## 5. Valider puis lancer le premier déploiement manuellement

1. Relire, committer et pousser les fichiers. Tant que `UID_DEV_AUTO_DEPLOY` est absente/false et que WordPress garde son automatisation désactivée, ce push **ne déploie pas**.
2. Dans Actions → **UID DEV — build and deploy** → Run workflow, sélectionner `main`, `action=validate`, `source=manual`, `first_deployment=false`. Cette action effectue les tests et le build réel via WordPress DEV, puis conserve un artifact statique 14 jours. Elle ne se connecte pas au serveur SSH et n’acquitte pas la file WordPress.
3. Examiner l’artifact, les journaux, l’API DEV, les IDs et la configuration serveur. Vérifier une restauration de la sauvegarde WordPress DEV séparément.
4. Contrôler les fichiers déjà présents dans la racine DEV. Le premier déploiement refusera toute collision avec un fichier existant non géré, même `index.html`. Sauvegarder puis déplacer manuellement seulement les fichiers explicitement remplacés ; ne pas supprimer WordPress, `.htaccess`, `index.php` ou les autres fichiers inconnus. Vérifier la priorité `index.html` dans nginx/Apache sur DEV.
5. **Après validation humaine**, lancer `action=deploy`, `source=manual`, `first_deployment=true`. Aucun script n’a effectué cette étape pour vous. Le script enregistre l’initialisation uniquement après une publication réussie.
6. Vérifier l’accueil, les deux pages jeunesse, l’agenda, les médias et `/wordpress/wp-admin/` sur DEV. Ne modifier aucune redirection de production.
7. Pour activer ensuite les automatismes, passer la variable **du dépôt** `UID_DEV_AUTO_DEPLOY=true` et `UID_GITHUB_DEPLOY_ENABLED=true` dans WordPress DEV. Un push sur `main` ou une modification WordPress DEV déclenchera alors un build et une publication DEV. Tester un vrai changement éditorial puis son acquittement.

Les reconstructions planifiées Actions tournent à 23:15 et 00:15 UTC pour retirer quotidiennement les événements passés malgré le changement d’heure suisse. Elles sont soumises au même garde d’activation ; elles peuvent être retardées par GitHub et ne garantissent pas un retrait exactement à minuit.

## 6. Garanties de publication et restauration

Rsync envoie uniquement vers `private/uid-dev/incoming/RUN-ATTEMPT/`, **sans `--delete`**. Il n’est jamais lancé sur la racine publique. Un manifeste SHA-256 liste les fichiers autorisés ; le serveur refuse les chemins dangereux, `/wordpress/`, les fichiers PHP, sources, secrets, liens symboliques et fichiers supplémentaires.

Le moteur vérifie tous les fichiers existants avant de modifier la racine. Un fichier non géré n’est ni écrasé ni supprimé. Un fichier géré modifié hors déploiement provoque un arrêt pour inspection. Les assets sont publiés avant le HTML. Les suppressions ne concernent que les fichiers de l’ancien manifeste absents du nouveau ; les anciens assets Astro des versions récentes sont conservés pour les pages déjà ouvertes.

Deux protections empêchent les publications concurrentes : groupe GitHub unique `uid-development` avec file d’attente et sans annuler un run en cours, puis verrou serveur. Les builds GitHub prennent le dernier `main` au démarrage, y compris pour WordPress. Les trois dernières versions statiques publiées sont conservées dans le répertoire privé. Un journal permet la restauration des fichiers gérés si la publication échoue.

### Rollback manuel

Consulter `private/uid-dev/state/history` pour les trois IDs de versions disponibles (`RUN_ID-ATTEMPT`). Dans Run workflow, sélectionner `action=rollback`, `source=manual`, `first_deployment=false`, puis saisir l’ID dans `release`. Le rollback utilise la copie statique conservée sur le serveur : pas de rebuild ni de dépendance à l’API WordPress. Il n’acquitte aucun contenu en attente.

Pour conserver durablement une version restaurée pendant un incident, désactiver d’abord `UID_DEV_AUTO_DEPLOY` et `UID_GITHUB_DEPLOY_ENABLED` ; sinon une modification en attente ou un push republiera le dernier `main`. Les médias restent hébergés dans WordPress : restaurer Astro ne récupère pas une image supprimée dans WordPress. La sauvegarde WordPress reste indispensable.

### Interruption brutale

Si `publish.lock` subsiste, consulter son fichier `pid` et vérifier qu’aucune publication n’est encore active avant de retirer ce seul verrou avec la connexion administrative. **Ne pas effacer `transaction/`.** Exécuter ensuite, avec la connexion administrative :

```sh
/usr/bin/bash /home/httpd/vhosts/fanfareuid.ch/private/uid-dev/bin/uid-publish.sh \
  /home/httpd/vhosts/fanfareuid.ch/private/uid-dev/server.env recover
```

La récupération restaure le journal précédent sans nouvelle publication. Si elle échoue, conserver le verrou et le journal pour inspection. La publication n’est pas un échange atomique de toute la racine ; une requête peut traverser brièvement deux générations de HTML. Les copies de fichiers sont atomiques et les assets précédents sont conservés.

Les uploads incomplets restent en staging privé et ne sont jamais servis. Après diagnostic, un administrateur peut nettoyer les anciens répertoires `incoming/RUN-ATTEMPT` dont les runs sont définitivement terminés. Ne pas supprimer les versions présentes dans `state/history` ni les marqueurs WordPress en attente.

## 7. Tests locaux et recette DEV

Depuis `astro/` :

```sh
npm ci
npm run check
npm test
npm run test:build
```

Node 24 et Python 3 sont utilisés sur le poste de développement et dans GitHub Actions. Les tests ouvrent une API simulée **uniquement en local**, avec des sorties temporaires. Aucun de ces tests ne contacte SSH ou ne publie sur DEV.

Avec PHP local ou dans Actions :

```sh
php -l wordpress/uid-headless/uid-headless.php
php -l wordpress/uid-headless/deployment.php
php wordpress/tests/deployment-test.php
```

Les tests PHP simulent les hooks et l’API GitHub ; ils vérifient la signature, le refus des replays, les retries et l’acquittement des snapshots. Ils ne remplacent pas une recette avec WordPress/ACF réels : créer/modifier/dépublier/supprimer un événement, remplacer une image, désactiver chaque session, enregistrer pendant un build, provoquer une panne API, puis vérifier le rollback. Confirmer que WordPress DEV et les fichiers non gérés sont conservés et que la production est inchangée.

Références : [déclenchement workflow GitHub](https://docs.github.com/en/rest/actions/workflows), [concurrence Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [WP-Cron via tâche système](https://developer.wordpress.org/plugins/cron/hooking-wp-cron-into-the-system-task-scheduler/).
