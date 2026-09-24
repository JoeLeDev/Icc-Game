# Assets PNG

Déposer ici les fichiers listés dans `docs/ASSETS_MANQUANTS.md`.

**Bâtiments roadside :** `building_01.png` … `building_03.png` (optionnel 04…06)  
→ **un seul immeuble isolé** par fichier (fond transparent, portrait ~1:2).  
Phaser place gauche/droite + `flipX`.  
`Building.png` = backdrop global uniquement, pas un roadside.

Au boot, chaque PNG trouvé remplace la texture procédurale du même rôle.
Recharger la page après ajout (`npm run dev`).
