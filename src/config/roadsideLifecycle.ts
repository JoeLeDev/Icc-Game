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
 * Multiplicateur de scroll selon phase + bande.
 * PASSED sort plus vite ; props NEAR plus rapides que buildings.
 */
export function roadsideScrollMul(
  phase: RoadsidePhase,
  band: 'far' | 'near',
): number {
  const base: Record<RoadsidePhase, number> = {
    FAR: 0.52,
    APPROACHING: 0.82,
    NEAR: 1.12,
    PASSED: 1.95,
  };
  const bandBoost = band === 'near' ? 1.12 : 1;
  return base[phase] * bandBoost;
}

export type ScreenBounds = { left: number; right: number; top: number; bottom: number };

export function isFullyOffscreen(
  bounds: ScreenBounds,
  viewportW: number,
  viewportH: number,
  margin = OFFSCREEN_MARGIN,
): boolean {
  return (
    bounds.bottom < -margin ||
    bounds.top > viewportH + margin ||
    bounds.right < -margin ||
    bounds.left > viewportW + margin
  );
}

/** Progression de sortie [0…+] quand z < 0 */
export function passedExitT(z: number, exitSpan = PASSED_EXIT_SPAN): number {
  if (z >= 0) return 0;
  return -z / exitSpan;
}
