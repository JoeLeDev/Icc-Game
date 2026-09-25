import type { HitRect } from '../systems/Hitbox';

/** Ennemis percutables à moto (pas les obstacles inertes / pickups). */
export const RAMMABLE_ENEMY_KINDS = ['depression', 'peur'] as const;
export type RammableEnemyKind = (typeof RAMMABLE_ENEMY_KINDS)[number];

export function isRammableEnemyKind(kind: string): kind is RammableEnemyKind {
  return (RAMMABLE_ENEMY_KINDS as readonly string[]).includes(kind);
}

export type EnemyRamResult = 'rear' | 'side_left' | 'side_right';

/** Coups de flanc nécessaires pour éliminer un ennemi moto */
export const MOTO_SIDE_HITS_TO_DEFEAT = 2;

/** Profondeur où l’ennemi moto reste au niveau du joueur (z≈0 = même Y écran) */
export const MOTO_HOLD_Z = 0;

/** Max d’ennemis moto simultanés (jamais 3) */
export const MAX_MOTO_FOES = 2;

/** I-frames après un coup latéral (évite double comptage) */
export const MOTO_RAM_IFRAMES = 0.55;

/** Intervalle de tir des motos ennemies une fois au niveau joueur (s) */
export const MOTO_SHOOT_INTERVAL = 2;

/** Délai avant le 1er tir après arriver au hold */
export const MOTO_SHOOT_FIRST_DELAY = 1.2;

/**
 * Seuil normalisé |dx| / (enemy.w/2).
 * Au-delà → flanc ; en-deçà → arrière (tolérance anti-flicker).
 */
export const ENEMY_SIDE_RATIO = 0.42;

/**
 * Zones logiques sur l’ennemi (plus petites que le sprite) pour debug / tests.
 * rear = bande centrale basse ; left/right = flancs.
 */
export function enemyZoneRects(enemy: HitRect): {
  rear: HitRect;
  left: HitRect;
  right: HitRect;
} {
  const sideW = enemy.w * 0.3;
  const rearW = enemy.w * 0.36;
  const rearH = enemy.h * 0.55;
  const sideH = enemy.h * 0.7;

  const rear: HitRect = {
    w: rearW,
    h: rearH,
    x: enemy.x,
    y: enemy.bottom - rearH / 2,
    left: enemy.x - rearW / 2,
    right: enemy.x + rearW / 2,
    top: enemy.bottom - rearH,
    bottom: enemy.bottom,
  };

  const left: HitRect = {
    w: sideW,
    h: sideH,
    x: enemy.left + sideW / 2,
    y: enemy.y,
    left: enemy.left,
    right: enemy.left + sideW,
    top: enemy.y - sideH / 2,
    bottom: enemy.y + sideH / 2,
  };

  const right: HitRect = {
    w: sideW,
    h: sideH,
    x: enemy.right - sideW / 2,
    y: enemy.y,
    left: enemy.right - sideW,
    right: enemy.right,
    top: enemy.y - sideH / 2,
    bottom: enemy.y + sideH / 2,
  };

  return { rear, left, right };
}

/**
 * Classifie l’impact joueur ↔ ennemi à partir des hitboxes (centres + overlap).
 * Ne se base pas uniquement sur player.x < enemy.x.
 */
export function classifyEnemyRam(
  player: HitRect,
  enemy: HitRect,
  sideRatio = ENEMY_SIDE_RATIO,
): EnemyRamResult {
  const ox = (Math.max(player.left, enemy.left) + Math.min(player.right, enemy.right)) / 2;
  const oy = (Math.max(player.top, enemy.top) + Math.min(player.bottom, enemy.bottom)) / 2;

  const nx = (ox - enemy.x) / Math.max(1, enemy.w * 0.5);
  const ny = (oy - enemy.y) / Math.max(1, enemy.h * 0.5);

  if (nx <= -sideRatio) return 'side_left';
  if (nx >= sideRatio) return 'side_right';

  if (Math.abs(nx) >= sideRatio * 0.72 && Math.abs(nx) > Math.abs(ny) * 0.55) {
    return nx < 0 ? 'side_left' : 'side_right';
  }

  return 'rear';
}

/** Après un coup latéral : vaincu si hits >= MOTO_SIDE_HITS_TO_DEFEAT */
export function sideHitDefeats(hitsAfter: number): boolean {
  return hitsAfter >= MOTO_SIDE_HITS_TO_DEFEAT;
}
