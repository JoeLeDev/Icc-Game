# Khayil 2026 — Intégration du pack graphique

Les fichiers finaux sont dans `public/assets/`, avec les noms et les dimensions de l’inventaire fourni. PNG RGBA 32 bits, transparence conservée. Les proportions des illustrations sont préservées : certains fichiers comportent des marges transparentes.

Les images ont été générées avec l’outil de génération d’images intégré, puis redimensionnées avec un filtre Lanczos et traitement de l’alpha prémultiplié. Ce sont des sprites fixes, sans animations image par image.

## Installation

1. Décompresser le pack.
2. Copier les PNG du dossier `public/assets/` dans le dossier du même nom du projet actuel.
3. Donner les instructions ci-dessous à Cursor dans la version contenant la pseudo-3D.

## Instructions pour Cursor

Intègre les nouveaux PNG de `public/assets/` dans le gameplay Khayil existant. Inspecte d’abord `AssetFactory.tryLoadExternalAssets`, `textureKey`, le chargement des scènes et `RoadProjection` pour utiliser le système déjà présent.

- Vérifie la correspondance de chaque fichier avec sa clé `_ext`. N’ajoute pas un second système de chargement.
- Commence par la moto, puis voiture/camion, équipements, obstacles/bonus, ennemis/effets et décor.
- Préserve le rapport largeur/hauteur de chaque sprite. Les dimensions du fichier ne sont pas les dimensions d’affichage dans le jeu : normalise les tailles visuelles par rapport aux anciennes textures avant d’appliquer l’échelle de profondeur.
- Les PNG contiennent des marges transparentes. Vérifie le point de contact des roues, pieds et poteaux avec la route. Ne calcule pas les collisions à partir de toute la surface rectangulaire transparente du PNG.
- Garde la logique de collision en voie/profondeur et vérifie sa correspondance visuelle, surtout pendant les changements de voie.
- Pour les équipements, conserve les identifiants, les décomptes uniques et les règles de collecte. Utilise les images également dans le HUD si la lisibilité le permet.
- Distingue `eq_shield.png` (équipement doré), `bonus_shield.png` (protection verte), `love_heart.png` (joker rose) et `bonus_life.png` (cœur rouge avec +).
- Les images d’ennemis et d’effets représentent une pose fixe. Conserve les animations, avertissements, fusibles, trajectoires et particules existants.
- Le décor ne doit pas masquer la chaussée ou les menaces. Place la skyline derrière la route et les props sur les bas-côtés. La route en trapèze reste dessinée par le moteur ; aucun `road_overlay.png` n’est fourni.
- Conserve les fallbacks procéduraux pour les textures absentes et gère les erreurs de chargement sans bloquer le démarrage.
- Ne change pas les règles, les durées de bonus ou la difficulté pendant cette passe d’intégration.

Vérifie le chargement sans erreurs réseau, le build, un parcours desktop et un viewport mobile. Vérifie en jeu la taille de la moto, les collisions, les collectes, la lisibilité des bonus, puis une pause/reprise et un redémarrage. Ne déclare pas les performances sur téléphone réel validées sans essai sur appareil.

## Vérifications du pack

Les dimensions, le mode RGBA et la présence de transparence sont contrôlés automatiquement. Les fichiers réduits sont inspectés sur fond sombre. Le fichier `manifest.json` liste les dimensions, le poids et l’empreinte de chaque PNG.

L’intégration dans la version pseudo-3D actuelle n’a pas été exécutée ici : le dépôt accessible correspond encore à la version initiale. Le placement, les tailles apparentes et les collisions restent à vérifier dans Cursor et sur téléphone.
