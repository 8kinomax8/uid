# Accueil UID — vérification du 4 novembre 2026

## Périmètre et direction

Direction existante conservée : Apfel Grotezk, graphite/jaune, thèmes clair et sombre, navigation, photos UID et GSAP. Aucun nouveau tirage de direction : il s’agit du remplacement du bloc d’ouverture dans le système existant, selon la proposition validée. Mode de la surface : Persuade (trouver une date et participer).

L’idée : le prochain rendez-vous réel de l’UID devient l’ouverture du site. L’élément vivant est la sélection chronologique WordPress, remplacée au fil des publications et du build quotidien. L’histoire reste dans Harmonie. La campagne des uniformes, puis les actualités que l’équipe choisira, assurent une entrée éditoriale entre deux événements.

Ordre : prochain rendez-vous / autres rendez-vous / actualité à la une / formations jeunesse. Sans événement : actualité en ouverture, message agenda discret, formations jeunesse. Sans actualité non plus : entrée jeunesse. Aucun carrousel ni événement inventé.

## Preuves et limites

Prévisualisation locale alimentée par une API WordPress simulée. Les dates 2099 et contenus « TEST » ou « données de démonstration » appartiennent exclusivement aux fixtures et aux captures de contrôle ; ils ne sont ni des événements validés ni un transfert dans WordPress. Le premier aperçu avait une référence d’image de fixture incorrecte ; elle a été corrigée dans la prévisualisation, sans changement d’un contenu réel.

Aucun ajout d’image extérieure ou générée. Images de la société déjà présentes dans `astro/public/images/`, médias éditoriaux sélectionnés dans WordPress en fonctionnement réel. Aucun clip disponible ajouté artificiellement. Les affiches sont intégralement visibles, sans recadrage.

Captures et résultats locaux, ignorés par Git : `.taste-skill/home-before/`, `.taste-skill/home-after/`, `.taste-skill/home-*-light.jpg`, `.taste-skill/home-*-dark.jpg`, `.taste-skill/home-fallback-*.jpg`, `.taste-skill/home-interactions.json`, `.taste-skill/impeccable-home-{mobile,desktop}.json`.

## Design Taste

- Lint des deux composants et de l’accueil : **0 FAIL, 0 WARN**.
- Inspection finale : **0 FAIL** à **1440, 768 et 390 px** ; débordement horizontal **0 px** à chaque largeur. Captures de premier écran et planches de page vues aux trois largeurs.
- Exception explicite `reduced-hidden` : le détecteur compte les liens des sous-menus de navigation fermés au repos comme du texte invisible. Ils doivent rester fermés, y compris en mouvement réduit, et deviennent accessibles au survol/focus ou dans le menu mobile. Le contenu principal en mouvement réduit et l’accès clavier ont été vérifiés séparément.
- Avertissements conservés et examinés : absence de vidéo (aucun clip réel nécessaire à la demande), quantité modérée de mouvement (convention du site, pas d’effets supplémentaires pour satisfaire un compteur), titre de fixture considéré comme un nom isolé (la date, le lieu et l’identité UID sont pourtant visibles à côté).

### ROUND 2

Seen in one second: titre du rendez-vous et image réelle ; en repli, financement des uniformes et action de soutien.

Idea (one sentence): le programme réel de l’UID remplace la présentation historique comme porte d’entrée.

Live thing: premier événement à venir sélectionné automatiquement, actualité WordPress modifiable et visionneuse de l’affiche.

Layout words by section: hero=split / agenda=note ou liste / actualité=champ de couleur / jeunesse=parcours photo.

Scores: design 7 · usability 8.5 · creativity 7 · content 8 → overall 7.6.

Caps applied: ambition visuelle contenue par le système existant ; créativité plafonnée à 7 pour une composition éditoriale connue ; design à 7 pour une motion volontairement discrète. Ce score est une appréciation de la prévisualisation, pas une certification externe.

Top three problems (most visible first), each with the screenshot it shows in and the fix:

1. Ancien premier écran dominé par l’identité et l’histoire (`home-before/*-fold.jpg`) : remplacé par titre, date, lieu, contenu et action du rendez-vous.
2. Zone « autres rendez-vous » surdimensionnée lorsqu’aucune autre date n’existe (`home-round1/desktop-fold.jpg`) : transformée en note agenda compacte dans la version finale.
3. Risque de répéter le prochain rendez-vous ou l’actualité : premier événement retiré de la liste et actualité rendue une seule fois ; tests HTML avec deux événements et avec l’actualité seule.

## Impeccable — vérification ciblée

Détecteur exécuté sur le rendu mobile 390×844 et bureau 1440×900 : **aucun constat** (JSON vide). Le contrôle visuel et les interactions complètent ce détecteur ; son résultat seul ne constitue pas une approbation esthétique ou une certification WCAG.

| Dimension | Score /4 | Éléments vérifiés |
| --- | --- | --- |
| Accessibilité | 3 | H1 unique, titres de sections, vrais boutons/liens, texte échappé, focus clavier, Échap, mouvement réduit. Pas de test avec lecteur d’écran physique. |
| Performance | 3 | HTML statique, requêtes médias et pages dédupliquées, une image prioritaire, autres événements et image éditoriale différés. Poids des médias originaux à surveiller. |
| Thèmes | 4 | Tokens existants ; contrôles visuels clair/sombre à 390, 768 et 1440 px. |
| Responsive | 3 | Aucun débordement, textes longs, boutons, menu et affiches vérifiés dans Chrome avec viewport/toucher émulé. Pas de test matériel iOS/Android. |
| Intégrité | 4 | Source CMS existante, aucun événement fictif en production, campagnes confirmées, modes explicites, champs invalides refusés. |
| Total | **17/20** | Bon ; limites de couverture indiquées ci-dessus. |

Pas de P0/P1 constaté dans ce périmètre. P2 préexistant : les originaux photographiques peuvent rester lourds pour un réseau lent ; une passe d’optimisation responsive serait distincte de cette modification éditoriale. Aucun nouvel effet permanent ni dépendance frontend.

## Vérification fonctionnelle

- `npm run check` : 0 erreur, 0 avertissement.
- `npm test` : 9 tests Node et 33 tests Python réussis.
- `npm run test:build` : builds peuplés avec deux événements, vides, actualité personnalisée, actualité masquée, sessions désactivées, erreur CMS et configuration absente vérifiés.
- Contrats PHP avec WordPress Playground local : réussis ; syntaxe du plugin vérifiée.
- Chrome : clair/sombre à 390/768/1440 px, lightbox, Échap, menu, lien d’évitement, mouvement réduit, repli sans événement, textes longs et HTML utilisable sans JavaScript.

Les règles de déploiement, signatures, protection DEV, chemins SSH et WordPress privé n’ont pas été modifiés. Aucun push, transfert ou déploiement n’a été exécuté.

## Mise en place

Voir la section « Accueil vivant » de `docs/wordpress-plesk.md` : mettre à jour `uid-headless.php` et `acf-fields.json` dans le plugin DEV, puis utiliser la fiche existante « Agenda et accueil ». Pas de nouvelle variable serveur. Le défaut reste la campagne des uniformes ; l’équipe peut choisir une actualité personnalisée ou masquer ce bloc.

Contexte Impeccable préexistant : `PRODUCT.md` conserve le format ancien avec `Register`, et `DESIGN.md` décrit une ancienne organisation de l’accueil. Ces migrations documentaires générales n’ont pas été faites ; le présent document décrit précisément le périmètre livré.
