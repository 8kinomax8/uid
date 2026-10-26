# UID — système visuel

Identité conservée : Union Instrumentale Delémont, Apfel Grotezk, graphite et jaune. La photographie réelle de la société porte l’identité visuelle. Les contenus, les itinéraires jeunesse et les fonctionnalités existantes restent la source de vérité.

## Typographie

Apfel Grotezk auto-hébergée : Satt 900 pour les titres de page, Fett 700 pour les titres de section, Mittel 500 pour les sous-titres et Regular 400 pour les textes. Titres sur deux lignes au maximum aux largeurs représentatives ; interlignage 1.08. Texte courant de 16 à 20 px, interlignage 1.55–1.6. Informations contextuelles sous le titre, sans petites étiquettes au-dessus.

## Couleurs et surfaces

Les rôles sont définis dans `astro/src/styles/global.css`. `--night` représente le fond, `--porcelain` le texte, `--surface` les surfaces secondaires et `--secondary` les informations de second niveau. Ils changent ensemble selon le thème. Les boutons utilisent `--accent-fill` / `--accent-ink`, indépendamment des liens de texte : le jaune reste lisible en thème clair et sombre.

Surfaces unies, sans dégradé décoratif. Séparation des sections par l’espace. Rayon de 4 px pour les médias et panneaux ; forme ronde pour les boutons. Le curseur baguette avec ombre et le changement de thème circulaire sont des conventions explicites du projet.

## Composition

Une même largeur maximale de 1280 px et des marges latérales fluides de 20 à 64 px pour la navigation, les titres, les contenus et le pied de page. Les titres des sections partagent leur ligne avec un paragraphe à droite sur ordinateur et passent en une colonne sur mobile.

Accueil : nom en grand, présentation et photo de l’ensemble, parcours jeunesse puis liste des événements. Les parcours jeunesse sont présentés dans l’ordre de progression. Les images et leur légende restent distinctes : pas de boutons superposés sur les photos.

Pages éditoriales : en-tête texte/photo commun. Un média identique n’est pas répété immédiatement dans le corps. Les affiches et logos gardent leurs proportions complètes. Les événements utilisent un même composant dans l’accueil et l’agenda. Les images verticales restent intégralement visibles à gauche du texte, y compris sur mobile ; sur ordinateur leur largeur est limitée à 180 px pour éviter une carte inutilement haute ; leur orientation est fournie par les données ou détectée au chargement. Les titres de section décrivent le contenu sans répéter le titre de page. Pour les sessions découvertes, les renseignements pratiques accompagnent le texte à droite de l’affiche sur ordinateur.

## Interactions et accessibilité

Actions principales : bouton jaune de 48 px minimum, retour de pression discret. Actions secondaires : liens soulignés. Focus visible, lien d’évitement, sous-menu accessible au clavier. Le menu mobile bloque le contenu arrière, contient le focus et rend le focus au bouton après Échap. Il se ferme lorsque la navigation de bureau redevient disponible.

Les révélations ont lieu une fois et respectent la préférence de mouvement réduit. Les interactions clavier du menu sont immédiates. Les effets au survol sont réservés aux pointeurs précis. Aucun nouvel effet décoratif permanent. Le logo conserve les mêmes dimensions et espacements dans les deux thèmes ; les marges verticales de l’en-tête suivent les marges latérales. Le nom dans le pied de page est centré. Les soulignements animés suivent le texte, indépendamment de la zone cliquable. Un seul mécanisme partagé (`.link-label`) couvre les liens textuels et les titres des cartes liées. La navigation reste sans soulignement ; le lien secondaire du héros garde sa ligne et sa position au repos comme au survol. Le logo reçoit 8 px de padding sur ses quatre côtés. La pointe du curseur possède un point blanc de 5 px en mode de fusion difference pour inverser le fond.

## Vérification

Tester les largeurs 1440, 768 et 390 px, les deux thèmes, les titres longs, le menu et la galerie. Compilation : `env ASTRO_TELEMETRY_DISABLED=1 npm run build` depuis `astro/`. Rapports et captures de cette passe : `.taste-skill/` (artifacts locaux ignorés par Git).

Les médias des rendez-vous ouvrent la visionneuse ; seul « En savoir plus » mène à leur destination. La galerie emploie une grille bento dont les images gardent leur rapport largeur/hauteur naturel, sans recadrage ni zoom au survol. La navigation nomme la page principale « Accueil ». Les adresses postales séparent rue et localité par un retour à la ligne.
