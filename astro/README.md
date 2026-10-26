# Site UID — Astro + WordPress headless

Astro statique, GSAP et Lenis. Le design et les textes fixes sont dans le dépôt ; les événements, sessions découvertes et la configuration Google Calendar viennent de WordPress au build.

## Développement

Node >=22.23.4, npm et une API WordPress configurée :

```sh
npm ci
cp .env.example .env
# Renseigner les quatre variables avec les valeurs de la préproduction.
npm run dev
```

Un build sans configuration valide échoue. Aucun événement fictif de secours n’est publié.

```sh
npm run check
npm test
npm run test:build
ASTRO_TELEMETRY_DISABLED=1 npm run build
```

Les tests de build utilisent une API simulée locale et des sorties temporaires ; ils ne nécessitent pas de WordPress réel et ne produisent pas de données de démonstration dans `dist/`.

Voir [le guide WordPress et Plesk](../docs/wordpress-plesk.md) pour l’installation, les contrats de champs, les scripts, la recette, la bascule et le rollback. L’extension se trouve dans `../wordpress/uid-headless/`, le lanceur dans `../deploy/`.
