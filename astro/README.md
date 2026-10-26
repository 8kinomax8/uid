# Site UID — Astro + WordPress headless

Astro statique, GSAP et Lenis. WordPress fournit événements, sessions découvertes et configuration Google Calendar au build. GitHub Actions construit avec **Node 24**, puis transfère le résultat vers **DEV uniquement** via SSH/rsync. Plesk n’a besoin ni de Node ni de npm.

## Développement et tests

```sh
npm ci
cp .env.example .env
# Renseigner les trois IDs de pages WordPress DEV.
npm run dev
```

L’URL de l’API DEV est `https://dev.fanfareuid.ch/wordpress/wp-json/wp/v2`. Un build DEV refuse la production, les redirections API et les médias hébergés hors DEV. Aucun événement fictif de secours n’est publié.

```sh
npm run check
npm test
npm run test:build
ASTRO_TELEMETRY_DISABLED=1 npm run build
```

Les tests Python de publication s’exécutent dans des répertoires temporaires, sans SSH réel. Les tests de build utilisent une API simulée locale et des sorties temporaires, sans WordPress réel.

Les commandes SSH/rsync utilisent `/dev.fanfareuid.ch` et `/private/uid-dev` dans le chroot ; WordPress/PHP conserve ses chemins complets Plesk.

Le [guide WordPress / GitHub Actions / Plesk](../docs/wordpress-plesk.md) décrit les clés SSH, les secrets, l’installation de l’extension et le rollback. Le workflow `.github/workflows/uid-dev.yml` reste bloqué pour les événements automatiques tant que `UID_DEV_AUTO_DEPLOY` n’est pas activée. Le premier déploiement doit être lancé manuellement après une exécution `validate` réussie.
