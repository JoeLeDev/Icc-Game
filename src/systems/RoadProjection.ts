import type { LayoutMetrics } from '../config/responsiveLayout';
import { PASSED_EXIT_SPAN, passedExitT } from '../config/roadsideLifecycle';

/** Projection route pseudo-3D : logique (lane, z) ↔ écran */
export class RoadProjection {
  horizonY = 253;
  playerY = 658;
  /** Bas du viewport navigateur (sortie PASSED) */
  viewportBottom = 844;
  /** Profondeur visible max (unités monde) */
  maxZ = 420;
  nearRoadHalf = 156;
  farRoadHalf = 21.45;
  centerX = 195;

  applyLayout(L: LayoutMetrics): void {
    this.horizonY = L.horizonY;
    this.playerY = L.playerY;
    this.viewportBottom = L.browserHeight;
    this.nearRoadHalf = L.nearRoadHalf;
    this.farRoadHalf = L.farRoadHalf;
    this.centerX = L.centerX;
  }

  /** t∈[0,1] : 0 = joueuse, 1 = horizon — clampé (gameplay / approach) */
  depthT(z: number): number {
    const t = Math.max(0, Math.min(1, z / this.maxZ));
    return t * t;
  }

  roadHalfAt(z: number): number {
    if (z < 0) {
      const exitT = passedExitT(z);
      return this.nearRoadHalf * (1 + exitT * 1.15);
    }
    const t = this.depthT(z);
    return this.nearRoadHalf + (this.farRoadHalf - this.nearRoadHalf) * t;
  }

  laneSpacingAt(z: number): number {
    return (this.roadHalfAt(Math.max(0, z)) * 2) / 3;
  }

  /**
   * Projection gameplay (voies).
   * z < 0 est clampé pour ne pas figer les hitboxes au plan joueur.
   */
  project(lane: number, z: number): { x: number; y: number; scale: number; t: number } {
    const zClamped = Math.max(0, z);
    const t = this.depthT(zClamped);
    const y = this.playerY + (this.horizonY - this.playerY) * t;
    const scale = 1 + (0.11 - 1) * t;
    const spacing = this.laneSpacingAt(zClamped);
    const x = this.centerX + (lane - 1) * spacing;
    return { x, y, scale: Math.max(0.08, scale), t };
  }

  /**
   * Projection décor roadside — autorise z < 0 (PASSED).
   * Continue vers le bas + élargissement latéral jusqu’à hors écran.
   */
  projectDecor(z: number): { y: number; roadHalf: number; t: number; exitT: number } {
    if (z >= 0) {
      const t = this.depthT(z);
      return {
        y: this.playerY + (this.horizonY - this.playerY) * t,
        roadHalf: this.roadHalfAt(z),
        t,
        exitT: 0,
      };
    }
    const exitT = passedExitT(z, PASSED_EXIT_SPAN);
    const y = this.playerY + exitT * (this.viewportBottom - this.playerY + 120);
    const roadHalf = this.nearRoadHalf * (1 + exitT * 1.2);
    return { y, roadHalf, t: 0, exitT };
  }

  /** Sortie visuelle douce d’une entité gameplay après le plan joueur */
  projectPast(lane: number, z: number): { x: number; y: number; scale: number; t: number } {
    if (z >= 0) return this.project(lane, z);
    const exitT = passedExitT(z, PASSED_EXIT_SPAN);
    const base = this.project(lane, 0);
    const y = this.playerY + exitT * (this.viewportBottom - this.playerY + 80);
    const scale = base.scale * (1 + Math.min(0.8, exitT) * 0.35);
    return { x: base.x, y, scale, t: 0 };
  }

  laneScreenX(lane: number): number {
    return this.project(lane, 0).x;
  }

  overlapsPlayer(
    lane: number,
    z: number,
    playerLane: number,
    opts: { zHit?: number } = {},
  ): boolean {
    const zHit = opts.zHit ?? 28;
    if (z < 0 || z > zHit) return false;
    return lane === playerLane;
  }
}

export const DEPTH = {
  bgSky: 0,
  bgAmbient: 1,
  bgCity: 2,
  cityMid: 2.55,
  ground: 3,
  roadsideBuildings: 4,
  road: 5,
  roadsideProps: 6,
  entityBase: 10,
  player: 50,
  fx: 60,
  hud: 100,
  pause: 200,
} as const;

export function entityDrawDepth(z: number, maxZ: number): number {
  const near = 1 - Math.max(0, Math.min(1, z / maxZ));
  return DEPTH.entityBase + Math.floor(near * 30);
}
