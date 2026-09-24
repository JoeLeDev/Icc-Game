# Assets graphiques — Khayil 2026

Des PNG dans `public/assets/` remplacent automatiquement les textures procédurales au boot
(`tryLoadExternalAssets` → promotion de la clé).

## Inventaire actuel (présent)

| Fichier | Dimensions | Statut |
|---------|------------|--------|
| `player_moto.png` | 256×384 | ✅ |
| `car.png` | 192×288 | ✅ |
| `truck.png` | 220×360 | ✅ |
| `barrel.png` | 128×160 | ✅ |
| `barrier.png` | 192×96 | ✅ |
| `cone.png` | 96×128 | ✅ |
| `hole.png` | 160×112 | ✅ |
| `love_heart.png` | 192×192 | ✅ |
| `bonus_magnet.png` … `bonus_boost.png` | 128×128 | ✅ (5) |
| `eq_*.png` (7 équipements) | 160×160 | ✅ |
| `enemy_depression/calomnie/peur/doute.png` | — | ✅ |
| `fx_projectile.png` / `fx_fire.png` | — | ✅ |
| `prop_lamp.png` / `prop_palm.png` | — | ✅ |
| `skyline.png` | 780×240 | ✅ horizon lointain |
| `Building.png` | 1310×1200 | ✅ backdrop ville global (`dressing-city`) — **pas** un roadside |
| `building_01.png` … `building_03.png` | 887×1774 | ✅ roadside isolés (1 immeuble / PNG) |
| `bg_panorama.png` | — | ⏳ panorama DA plein écran |

## Bâtiments roadside (convention)

**1 fichier = 1 bâtiment isolé.** Phaser place à gauche/droite et peut `flipX`.

| Fichier | Notes |
|---------|--------|
| `building_01.png` … `building_03.png` | ✅ Portrait ~1:2, un seul immeuble toit→sol |
| `building_04` … `06` | Optionnel — variantes (hôtel néon, commercial bas…) |

### Ne pas fournir pour roadside

- Scène / skyline / îlot de ville entier
- Base en diagonale extrême
- Rue, route, véhicules, personnages
- Plusieurs bâtiments dans le même PNG

`Building.png` reste réservé au **background global**, pas à `building_0N`.

## Encore manquant

| Fichier | Notes |
|---------|--------|
| `building_04` … `06` | Optionnels pour plus de variété |
| `reject` / panneau voie fermée | Pas de PNG dédié |

## Convention générale

| Propriété | Valeur |
|-----------|--------|
| Format | PNG 32-bit, **transparence** |
| Fond | Transparent |
| Dossier | `public/assets/` |
