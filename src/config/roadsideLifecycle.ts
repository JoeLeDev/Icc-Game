/**
 * Cycle de vie décor NEAR / roadside — phases & sortie d’écran.
 * Séparé du gameplay (obstacles) pour ne pas casser les collisions.
 */

export type RoadsidePhase = 'FAR' | 'APPROACHING' | 'NEAR' | 'PASSED';

/** Plan joueur en Z monde (z=0) */
export const PLAYER_PLANE_Z = 0;

/** Span Z pour la sortie visuelle après passage (PASSED → offscreen) */
export const PASSED_EXIT_SPAN = 90;

/** Marge px avant despawn bounds */
export const OFFSCREEN_MARGIN = 56;

export function roadsidePhase(z: number, maxZ: number): RoadsidePhase {
  if (z <= PLAYER_PLANE_Z) return 'PASSED';
  const u = z / Math.max(1, maxZ);
  if (u > 0.55) return 'FAR';
  if (u > 0.22) return 'APPROACHING';
  return 'NEAR';
}

/**
 * Multiplicateur de scroll — CONSTANT par bande (parallax),
 * sans saut FAR→NEAR→PASSED qui provoquait un freinage/accélération artificielle.
 */
export function roadsideScrollMul(
  _phase: RoadsidePhase,
  band: 'far' | 'near',
): number {
  return band === 'far' ? 0.9 : 1;
}

export type ScreenBounds = { left: number; right: number; top: number; bottom: number };

/** Despawn principal PASSED : haut du sprite sous le bas du viewport */
export function isDespawnedPastBottom(
  bounds: ScreenBounds,
  viewportH: number,
  margin = OFFSCREEN_MARGIN,
): boolean {
  return bounds.top > viewportH + margin;
}

export function isFullyOffscreen(
  bounds: ScreenBounds,
  viewportW: number,
  viewportH: number,
  margin = OFFSCREEN_MARGIN,
): boolean {
  return (
    isDespawnedPastBottom(bounds, viewportH, margin) ||
    bounds.bottom < -margin ||
    bounds.right < -margin ||
    bounds.left > viewportW + margin
  );
}

/** Progression de sortie [0…+] quand z < 0 */
export function passedExitT(z: number, exitSpan = PASSED_EXIT_SPAN): number {
  if (z >= 0) return 0;
  return -z / exitSpan;
}
