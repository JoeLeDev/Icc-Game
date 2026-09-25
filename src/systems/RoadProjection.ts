import type { LayoutMetrics } from '../config/responsiveLayout';
import { projectYContinuous, roadHalfFromScreenY } from '../config/continuousProjection';
import { PASSED_EXIT_SPAN, passedExitT } from '../config/roadsideLifecycle';

/** Projection route pseudo-3D : logique (lane, z) ↔ écran */
export class RoadProjection {
  horizonY = 253;
  playerY = 658;
  viewportBottom = 844;
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

  /**
   * Foreshortening pour SCALE uniquement (pas pour Y ni largeur de route).
   */
  depthT(z: number): number {
    const t = Math.max(0, Math.min(1, z / this.maxZ));
    return t * t;
  }

  /**
   * Demi-largeur pour GAMEPLAY / largeur de voie.
   * z < 0 : figée (les lanes ne s’éjectent pas hors écran).
   */
  roadHalfAt(z: number): number {
    if (z < 0) return this.nearRoadHalf;
    return roadHalfFromScreenY(
      this.projectY(z),
      this.horizonY,
      this.playerY,
      this.nearRoadHalf,
      this.farRoadHalf,
    );
  }

  /**
   * Demi-largeur DÉCOR — continue à croître après le plan joueur (Y↓).
   * Corrige le retour vers le centre en PASSED.
   */
  decorRoadHalfAt(z: number): number {
    return roadHalfFromScreenY(
      this.projectY(z),
      this.horizonY,
      this.playerY,
      this.nearRoadHalf,
      this.farRoadHalf,
    );
  }

  laneSpacingAt(z: number): number {
    return (this.roadHalfAt(Math.max(0, z)) * 2) / 3;
  }

  /** Y écran continu (approche → joueur → passed), sans freinage à z=0 */
  projectY(z: number): number {
    return projectYContinuous(z, this.maxZ, this.horizonY, this.playerY);
  }

  project(lane: number, z: number): { x: number; y: number; scale: number; t: number } {
    const zForScale = Math.max(0, z);
    const t = this.depthT(zForScale);
    const y = this.projectY(z);
    // Scale : foreshortening + légère croissance après le plan joueur
    let scale = 1 + (0.11 - 1) * t;
    if (z < 0) {
      scale = 1 + Math.min(0.45, passedExitT(z, PASSED_EXIT_SPAN) * 0.25);
    }
    const spacing = this.laneSpacingAt(zForScale);
    const x = this.centerX + (lane - 1) * spacing;
    return { x, y, scale: Math.max(0.08, scale), t };
  }

  /**
   * Décor roadside — Y continue + roadHalf qui CONTINUE à croître en PASSED
   * (même formule qu’en approche, extrapolée sous playerY).
   */
  projectDecor(z: number): { y: number; roadHalf: number; t: number; exitT: number } {
    const y = this.projectY(z);
    const roadHalf = this.decorRoadHalfAt(z);
    if (z >= 0) {
      return { y, roadHalf, t: this.depthT(z), exitT: 0 };
    }
    return {
      y,
      roadHalf,
      t: 0,
      exitT: passedExitT(z, PASSED_EXIT_SPAN),
    };
  }

  /** Même trajectoire continue que project() pour les entités gameplay */
  projectPast(lane: number, z: number): { x: number; y: number; scale: number; t: number } {
    return this.project(lane, z);
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
