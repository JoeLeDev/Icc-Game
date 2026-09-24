# Khayil 2026 — Équipée pour conquérir

Mini-jeu web HTML5 (runner) pour la Conférence des Femmes Khayil 2026.

## Stack

- Vite + TypeScript + Phaser 3
- Assets procéduraux (aucune image externe requise)
- Pas de backend — scores et préférences en `localStorage`

## Lancer

```bash
npm install
npm run dev
```

Build production :

```bash
npm run build
npm run preview
```

## Jouabilité

- **Mobile** : swipe gauche / droite (+ boutons ◀ ▶)
- **Desktop** : flèches ou A / D
- Objectif : récupérer les **7 équipements**, survivre à la phase finale
- L'**Amour** est un joker rare (non requis)

Réglages (vitesse, spawns, durées) : `src/config/gameConfig.ts`
# Icc-Game
