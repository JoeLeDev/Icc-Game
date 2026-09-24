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
| `skyline.png` | 780×240 | ✅ |

## Encore manquant / à améliorer

| Fichier | Notes |
|---------|--------|
| `reject` / panneau voie fermée | Pas de PNG dédié (procédural) |
| `distraction` | Pas de PNG dédié |
| Transparence | `player_moto.png` a un **fond noir** — idéalement PNG transparent pour le menu / auras |

## Convention

| Propriété | Valeur |
|-----------|--------|
| Format | PNG 32-bit, **transparence** |
| Angle | Vue de dos / ¾ arrière |
| Fond | Transparent (pas de décor découpé) |
| Dossier | `public/assets/` |

## Ne pas fournir

- Découpes maquette avec morceau de fond
- Atlas unique comme fond de course
- Assets vue de profil pure
