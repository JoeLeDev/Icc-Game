import { GAME_H, GAME_W } from '../config/gameConfig';

/** Projection route pseudo-3D : logique (lane, z) ↔ écran */
export class RoadProjection {
  readonly horizonY = GAME_H * 0.30;
  readonly playerY = GAME_H * 0.78;
  /** Profondeur visible max (unités monde) */
  readonly maxZ = 420;
  readonly nearRoadHalf = GAME_W * 0.40;
  readonly farRoadHalf = GAME_W * 0.055;
  readonly centerX = GAME_W * 0.5;

  /** t∈[0,1] : 0 = joueuse, 1 = horizon */
  depthT(z: number): number {
    const t = Math.max(0, Math.min(1, z / this.maxZ));
    // Foreshortening : accélère le rétrécissement près de l’horizon
    return t * t;
  }

  roadHalfAt(z: number): number {
    const t = this.depthT(z);
    return this.nearRoadHalf + (this.farRoadHalf - this.nearRoadHalf) * t;
  }

  laneSpacingAt(z: number): number {
    return (this.roadHalfAt(z) * 2) / 3;
  }

  project(lane: number, z: number): { x: number; y: number; scale: number; t: number } {
    const t = this.depthT(z);
    const y = this.playerY + (this.horizonY - this.playerY) * t;
    const scale = 1 + (0.11 - 1) * t;
    const spacing = this.laneSpacingAt(z);
    const x = this.centerX + (lane - 1) * spacing;
    return { x, y, scale: Math.max(0.08, scale), t };
  }

  /** X écran pour une voie à la profondeur de la joueuse (z≈0) */
  laneScreenX(lane: number): number {
    return this.project(lane, 0).x;
  }

  /** Hitbox logique : même voie + proximité en profondeur */
  overlapsPlayer(
    lane: number,
    z: number,
    playerLane: number,
    opts: { zHit?: number; allowAdjacentDuringSwitch?: boolean; switching?: boolean } = {},
  ): boolean {
    const zHit = opts.zHit ?? 28;
    if (z < 0 || z > zHit) return false;
    if (lane === playerLane) return true;
    return false;
  }
}

export const DEPTH = {
  sky: 0,
  cityFar: 1,
  cityNear: 2,
  roadsideFar: 3,
  road: 4,
  roadsideNear: 5,
  entityBase: 10,
  player: 50,
  fx: 60,
  hud: 100,
  pause: 200,
} as const;

/** Depth d’affichage pour un objet en z (plus près = plus haut) */
export function entityDrawDepth(z: number, maxZ: number): number {
  const near = 1 - Math.max(0, Math.min(1, z / maxZ));
  return DEPTH.entityBase + Math.floor(near * 30);
}
