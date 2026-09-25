import { describe, expect, it } from 'vitest';
import {
  projectSceneryX,
  projectYContinuous,
  sceneryAbsCenterDelta,
  screenYSpeedForDz,
} from './continuousProjection';
import { RoadProjection } from '../systems/RoadProjection';
import { computeLayout } from './responsiveLayout';

/** Échantillons z : horizon → bas écran (avant despawn) */
function trajectoryZs(maxZ: number): number[] {
  return [
    maxZ * 0.95, // horizon
    maxZ * 0.75, // 75 %
    maxZ * 0.5, // 50 %
    maxZ * 0.12, // proche joueur
    0, // niveau joueur
    -15, // juste après
    -60, // bas écran
    -110, // juste avant despawn typique
  ];
}

describe('sceneryTrajectory — X ne revient jamais vers le centre', () => {
  const maxZ = 420;
  const horizonY = 250;
  const playerY = 730;
  const centerX = 195;
  const nearHalf = 156;
  const farHalf = 22;
  const lateralMul = 1.35;
  const margin = 8;

  it('élément GAUCHE : screenX < vanishingPoint et |Δ| monotone croissante', () => {
    const zs = trajectoryZs(maxZ);
    let prevAbs = -1;
    let prevY = -Infinity;
    for (const z of zs) {
      const x = projectSceneryX(
        -1,
        z,
        maxZ,
        centerX,
        horizonY,
        playerY,
        nearHalf,
        farHalf,
        lateralMul,
        margin,
      );
      const y = projectYContinuous(z, maxZ, horizonY, playerY);
      const abs = Math.abs(x - centerX);
      expect(x - centerX).toBeLessThan(0);
      expect(abs).toBeGreaterThanOrEqual(prevAbs - 1e-9);
      expect(y).toBeGreaterThanOrEqual(prevY - 1e-9);
      prevAbs = abs;
      prevY = y;
    }
  });

  it('élément DROIT : screenX > vanishingPoint et |Δ| monotone croissante', () => {
    const zs = trajectoryZs(maxZ);
    let prevAbs = -1;
    for (const z of zs) {
      const x = projectSceneryX(
        1,
        z,
        maxZ,
        centerX,
        horizonY,
        playerY,
        nearHalf,
        farHalf,
        lateralMul,
        margin,
      );
      const abs = Math.abs(x - centerX);
      expect(x - centerX).toBeGreaterThan(0);
      expect(abs).toBeGreaterThanOrEqual(prevAbs - 1e-9);
      prevAbs = abs;
    }
  });

  it('aucun retour vers le centre autour du plan joueur (pas à pas fin)', () => {
    for (const side of [-1, 1] as const) {
      let prev = sceneryAbsCenterDelta(
        side,
        40,
        maxZ,
        centerX,
        horizonY,
        playerY,
        nearHalf,
        farHalf,
        lateralMul,
        margin,
      );
      for (let z = 40; z >= -120; z -= 2) {
        const abs = sceneryAbsCenterDelta(
          side,
          z,
          maxZ,
          centerX,
          horizonY,
          playerY,
          nearHalf,
          farHalf,
          lateralMul,
          margin,
        );
        expect(abs).toBeGreaterThanOrEqual(prev - 1e-6);
        prev = abs;
      }
    }
  });

  it('Y : pas de ralentissement au niveau moto (vitesse écran croît ou se maintient)', () => {
    const samples = [maxZ * 0.8, maxZ * 0.4, 20, 5, 0, -5, -20];
    let prevSpeed = 0;
    for (const z of samples) {
      const spd = Math.abs(screenYSpeedForDz(z, maxZ, horizonY, playerY));
      // Near / passed : au moins aussi rapide que loin
      if (z <= maxZ * 0.4) {
        expect(spd).toBeGreaterThanOrEqual(prevSpeed * 0.85);
      }
      prevSpeed = Math.max(prevSpeed, spd);
    }
    const atPlayer = Math.abs(screenYSpeedForDz(0, maxZ, horizonY, playerY));
    const far = Math.abs(screenYSpeedForDz(maxZ * 0.7, maxZ, horizonY, playerY));
    expect(atPlayer).toBeGreaterThan(far);
  });
});

describe('sceneryTrajectory — RoadProjection.projectDecor branché', () => {
  it('decorRoadHalf croît sur toute la trajectoire (layout réel)', () => {
    const L = computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    const proj = new RoadProjection();
    proj.applyLayout(L);
    const zs = trajectoryZs(proj.maxZ);
    let prevHalf = -1;
    let prevY = -Infinity;
    for (const z of zs) {
      const d = proj.projectDecor(z);
      expect(d.roadHalf).toBeGreaterThanOrEqual(prevHalf - 1e-9);
      expect(d.y).toBeGreaterThanOrEqual(prevY - 1e-9);
      prevHalf = d.roadHalf;
      prevY = d.y;
    }
  });

  it('side stable : X reste du même côté du vanishing point', () => {
    const L = computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    const proj = new RoadProjection();
    proj.applyLayout(L);
    const lateralMul = 1 + L.propLateralFactor;
    for (const side of [-1, 1] as const) {
      for (const z of trajectoryZs(proj.maxZ)) {
        const d = proj.projectDecor(z);
        const x = proj.centerX + side * (d.roadHalf * lateralMul + 8);
        expect(Math.sign(x - proj.centerX)).toBe(side);
      }
    }
  });
});
