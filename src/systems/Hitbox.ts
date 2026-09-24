/**
 * Hitboxes alignées sur les pixels opaques mesurés des PNG (pas des valeurs arbitraires).
 *
 * Mesures alpha (seuil 16) sur public/assets :
 * - player_moto 256×384 : insetX≈0.164, insetY≈0.01
 * - eq_shield               : insetX≈0.11,  insetY≈0.01
 * - eq_belt                 : insetX≈0.01,  insetY≈0.27
 * - car / barrier / barrel  : variables → moyenne conservatrice
 *
 * Insets légèrement sous la marge transparente → hitbox ≈ contenu visible
 * (évite un pickup trop tardif). Pas d’inflation artificielle.
 */

export interface HitRect {
  x: number;
  y: number;
  w: number;
  h: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Fractions trimées de chaque côté du displaySize.
 * Dérivées des marges transparentes réelles (+ petite tolérance anti-pixel).
 */
export const HIT_INSETS = {
  /** moto : sides ~16 % transparent, quasi plein en hauteur */
  player: { x: 0.15, y: 0.04 },
  /** équipements : compromis shield/belt/sword */
  equipment: { x: 0.1, y: 0.08 },
  bonus: { x: 0.1, y: 0.08 },
  love: { x: 0.06, y: 0.08 },
  obstacle: { x: 0.08, y: 0.1 },
  enemy: { x: 0.1, y: 0.1 },
  projectile: { x: 0.06, y: 0.06 },
} as const;

export type HitRole = keyof typeof HIT_INSETS;

export function makeHitRect(
  centerX: number,
  centerY: number,
  displayW: number,
  displayH: number,
  insetX: number,
  insetY: number,
): HitRect {
  const w = Math.max(4, displayW * (1 - 2 * insetX));
  const h = Math.max(4, displayH * (1 - 2 * insetY));
  const left = centerX - w / 2;
  const right = centerX + w / 2;
  const top = centerY - h / 2;
  const bottom = centerY + h / 2;
  return { x: centerX, y: centerY, w, h, left, right, top, bottom };
}

export function hitRectForRole(
  centerX: number,
  centerY: number,
  displayW: number,
  displayH: number,
  role: HitRole,
): HitRect {
  const inset = HIT_INSETS[role];
  return makeHitRect(centerX, centerY, displayW, displayH, inset.x, inset.y);
}

export function aabbOverlap(a: HitRect, b: HitRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Test balayé : détecte un croisement entre deux positions d’une hitbox mobile
 * (anti-tunneling à bas FPS / haute vitesse).
 */
export function aabbSweptOverlap(
  staticBox: HitRect,
  from: HitRect,
  to: HitRect,
  steps = 4,
): boolean {
  if (aabbOverlap(staticBox, to) || aabbOverlap(staticBox, from)) return true;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const sample: HitRect = {
      x,
      y,
      w: to.w,
      h: to.h,
      left: x - to.w / 2,
      right: x + to.w / 2,
      top: y - to.h / 2,
      bottom: y + to.h / 2,
    };
    if (aabbOverlap(staticBox, sample)) return true;
  }
  return false;
}

export function hitRoleForKey(logicalKey: string): HitRole {
  const key = logicalKey.replace(/_ext$/, '');
  if (key === 'player') return 'player';
  if (key.startsWith('eq-')) return 'equipment';
  if (key.startsWith('bonus-')) return 'bonus';
  if (key === 'love') return 'love';
  if (key === 'projectile') return 'projectile';
  if (
    key === 'depression' ||
    key === 'calomnie' ||
    key === 'peur' ||
    key === 'doute' ||
    key === 'colere' ||
    key === 'reject'
  ) {
    return 'enemy';
  }
  return 'obstacle';
}

export function estimateVisualContactZ(opts: {
  maxZ: number;
  playerY: number;
  horizonY: number;
  playerHitH: number;
  equipHitH: number;
}): number {
  const span = Math.max(1, opts.playerY - opts.horizonY);
  const tMax = (opts.playerHitH / 2 + opts.equipHitH / 2) / span;
  const t = Math.min(1, Math.max(0, tMax));
  return Math.sqrt(t) * opts.maxZ;
}

/** Déplacement écran max attendu pour un objet proche (px/frame) — estimation. */
export function estimateNearScreenDeltaY(opts: {
  scrollSpeed: number;
  dt: number;
  z: number;
  maxZ: number;
  playerY: number;
  horizonY: number;
}): number {
  const { scrollSpeed, dt, z, maxZ, playerY, horizonY } = opts;
  const dz = scrollSpeed * dt;
  const dyDz = (2 * (horizonY - playerY) * z) / (maxZ * maxZ);
  return Math.abs(dyDz * dz);
}
