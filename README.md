# Khayil 2026 — Équipée pour conquérir

Mini-jeu web HTML5 (runner) pour la Conférence des Femmes Khayil 2026.

## Stack

- Vite + TypeScript + Phaser 3
- Décor pseudo-3D + sprites WebP dans `public/assets/`, avec textures procédurales de secours
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
- **Menus** : Tab puis Entrée/Espace ; Échap pour la pause. Sur Safari avec navigation clavier limitée, utiliser Option+Tab.
- Le menu propose le son, les effets réduits et un classement par difficulté. Les anciennes parties restent consultables séparément.
- Les écrans défilent sur les petites hauteurs et respectent les zones réservées aux encoches.

## Chargement et validation

`PrepareScene` attend les sprites et décors avant chaque lancement, y compris depuis le tutoriel. Un téléchargement bloqué expire après 8 secondes ; le joueur peut réessayer ou continuer avec les visuels de secours. Les images déjà installées ne sont pas remplacées pendant une partie.

```bash
npm run check
npx playwright install chromium webkit
npm run test:e2e
```

Les tests couvrent Chromium et WebKit avec émulation mobile ; ils ne remplacent pas un essai sur téléphone réel.

`EntityManager` possède la collection et sa destruction. `EntityRuntime` gère les déplacements, durées de vie, collisions et dégâts ; `CollisionDetector` gère les contacts et `MotoAttacks` les tirs.

Réglages : `src/config/gameConfig.ts`  
Liste des sprites manquants : `docs/ASSETS_MANQUANTS.md`
