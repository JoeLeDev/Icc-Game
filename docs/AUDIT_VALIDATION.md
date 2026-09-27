# Validation de l’audit — 27 septembre 2026

## Changements

- Préparation commune avant toute partie, téléchargement mutualisé, délai de 8 secondes, nouvelle tentative et visuels procéduraux de secours. Les tâches abandonnées n’activent plus une ancienne transition.
- Menus HTML au-dessus du canvas Phaser : navigation clavier, focus visible, défilement tactile, safe areas, disposition en colonnes sur petites hauteurs en paysage. La pause utilise les mêmes contrôles.
- Classements par difficulté et catégorie séparée pour les anciennes parties ; détail des points ; préférence persistante de réduction des flashes, secousses et particules.
- Collection d’entités en lecture seule pour les consommateurs ; destruction centralisée. Déplacement, fusibles, barils, contacts, résolution des pickups, dégâts et attaques moto dans `EntityRuntime`, `CollisionDetector` et `MotoAttacks`.
- Correction de collision : après un rebond, les contacts suivants utilisent la nouvelle position du joueur. Un coup de flanc victorieux ne coûte pas de vie. Un choc arrière ne blesse que le joueur, sans supprimer la moto adverse, augmenter ses coups reçus ou modifier son attaque. Les projectiles déjà tirés restent dangereux.

## Vérifications

Résultat : lint, compilation et build réussis ; 235 tests unitaires ; 37 tests E2E réussis sur 38 cas, avec un swipe CDP exclu de WebKit. Les 18 cas responsive ont également été rejoués après le dernier ajustement des safe areas, tous réussis.

Les tests navigateur couvrent les parcours répétés, le tutoriel, les téléchargements retardés/échoués, l’abandon du chargement, les quatre tailles 390×844, 320×568, 844×480 et 568×320, la rotation, les safe areas, le clavier et les préférences. Les erreurs JavaScript inattendues font échouer les tests.

Chromium et WebKit sont exécutés localement. Les taps tactiles sont exercés sur les deux moteurs ; le swipe injecté avec CDP est réservé à Chromium. Aucun téléphone physique n’a été testé.

## Mesure du premier chargement

Rapport local : `reports/audit-mobile.json` (ignoré par Git), produit avec Lighthouse en simulation mobile, sur le build de production servi par Vite preview. Une mesure, sans exécution simultanée des tests navigateur.

| Indicateur | Valeur |
| --- | --- |
| Performance | 65/100 |
| FCP | 4,49 s |
| LCP | 4,50 s |
| Speed Index | 4,49 s |
| Temps de blocage total | 330 ms |
| Décalage de mise en page (CLS) | 0 |
| Transfert total mesuré | 1 248 Kio |

Le rapport n’a ni erreur d’exécution ni avertissement. Le bundle reste proche de 374 Ko gzip. Lighthouse estime 206 Kio de JavaScript inutilisé sur ce parcours menu ; ce chiffre n’implique pas que ce code soit inutile pendant la partie. Le prochain chantier de livraison consiste à comparer une séparation moteur/application ou un démarrage différé du moteur. Aucun découpage spéculatif n’a été ajouté dans ce lot.

Reproduction (avec le serveur lancé séparément sur le port choisi) :

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4175
# Dans un autre terminal :
npx lighthouse http://127.0.0.1:4175/ --only-categories=performance --form-factor=mobile --max-wait-for-load=20000 --output=json --output-path=reports/audit-mobile.json --chrome-flags="--headless --no-sandbox"
```

## Observation en partie

Chromium headless, viewport 390×844, difficulté normale, deux fenêtres successives de 12 secondes. Invincibilité temporairement prolongée dans le navigateur de diagnostic pour éviter qu’une mort interrompe la mesure. Pas de modification de cette règle dans le jeu livré.

| CPU émulé | Frames observées | FPS affichés par Phaser en fin de fenêtre | Pic d’entités |
| --- | --- | --- | --- |
| Sans ralentissement | 689 | 59,1 | 3 |
| Ralenti ×4 | 619 | 52,8 | 6 |

Les fenêtres correspondent à des phases différentes de la même partie ; ce n’est pas une comparaison contrôlée. Les deltas de simulation Phaser sont lissés et ne constituent pas une mesure exhaustive des saccades. Ces résultats ne couvrent ni une longue session, ni la phase finale dense, ni la chauffe ou les performances GPU d’un téléphone réel.
