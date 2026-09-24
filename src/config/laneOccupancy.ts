/**
 * Occupation de voie (displayWidth / laneWidthNear) — hiérarchie visuelle.
 * Les hauteurs suivent le ratio PNG ; la largeur cible remplit la voie.
 */

export type LaneOccupancyRole =
  | 'motorcycle'
  | 'car'
  | 'truck'
  | 'largeObstacle'
  | 'smallObstacle'
  | 'equipment'
  | 'bonus'
  | 'enemy'
  | 'projectile';

/** Ratios cibles à z≈0 (près du joueur) */
export const LANE_OCCUPANCY: Record<LaneOccupancyRole, number> = {
  motorcycle: 0.72,
  car: 0.76,
  truck: 0.86,
  largeObstacle: 0.7,
  smallObstacle: 0.48,
  equipment: 0.36,
  bonus: 0.32,
  enemy: 0.55,
  projectile: 0.22,
};

/** Map clé logique → rôle d’occupation */
export function occupancyRoleForKey(logicalKey: string): LaneOccupancyRole | null {
  const key = logicalKey.replace(/_ext$/, '');
  if (key === 'player') return 'motorcycle';
  if (key === 'car') return 'car';
  if (key === 'truck') return 'truck';
  if (key === 'barrel' || key === 'barrier' || key === 'reject') return 'largeObstacle';
  if (key === 'cone' || key === 'hole') return 'smallObstacle';
  if (key.startsWith('eq-') && !key.startsWith('eq-icon-')) return 'equipment';
  if (key === 'love' || key.startsWith('bonus-')) return 'bonus';
  if (
    key === 'depression' ||
    key === 'calomnie' ||
    key === 'peur' ||
    key === 'doute' ||
    key === 'colere'
  ) {
    return 'enemy';
  }
  if (key === 'projectile') return 'projectile';
  return null;
}

export function targetWidthForLane(
  laneWidthNear: number,
  role: LaneOccupancyRole,
): number {
  return laneWidthNear * LANE_OCCUPANCY[role];
}

/**
 * Fade d’introduction près de l’horizon.
 * alpha 0 à z≈maxZ, alpha 1 après ~10 % de parcours vers le joueur.
 */
export const HORIZON_FADE_START = 0.98; // fraction de maxZ (spawn)
export const HORIZON_FADE_END = 0.88; // alpha plein

export function horizonFadeAlpha(z: number, maxZ: number): number {
  if (z <= 0) return 1;
  const start = maxZ * HORIZON_FADE_START;
  const end = maxZ * HORIZON_FADE_END;
  if (z >= start) return 0;
  if (z <= end) return 1;
  return (start - z) / Math.max(1e-3, start - end);
}

/** Spawn près du point de fuite (pas au milieu de la route) */
export function horizonSpawnZ(maxZ: number): number {
  return maxZ * HORIZON_FADE_START;
}
