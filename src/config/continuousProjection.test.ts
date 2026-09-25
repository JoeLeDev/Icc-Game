import { describe, expect, it } from 'vitest';
import {
  Y_APPROACH_POWER,
  depthProgress,
  projectSceneryX,
  projectYContinuous,
  roadHalfFromScreenY,
  sceneryAbsCenterDelta,
  screenYSpeedForDz,
} from './continuousProjection';

describe('continuousProjection — pas de freinage près du joueur', () => {
  const maxZ = 420;
  const horizonY = 250;
  const playerY = 730;

  it('Y est continu à z=0 (approche → passed)', () => {
    const y0 = projectYContinuous(0, maxZ, horizonY, playerY);
    const yNeg = projectYContinuous(-1, maxZ, horizonY, playerY);
    const yPos = projectYContinuous(1, maxZ, horizonY, playerY);
    expect(y0).toBeCloseTo(playerY, 5);
    // En s’approchant (z diminue), Y écran augmente (vers le bas)
    expect(yNeg).toBeGreaterThan(y0);
    expect(yPos).toBeLessThan(y0);
  });

  it('la vitesse verticale écran ne s’effondre pas près de z=0', () => {
    const nearPlayer = Math.abs(screenYSpeedForDz(5, maxZ, horizonY, playerY));
    const mid = Math.abs(screenYSpeedForDz(maxZ * 0.4, maxZ, horizonY, playerY));
    const far = Math.abs(screenYSpeedForDz(maxZ * 0.85, maxZ, horizonY, playerY));
    // Plus proche ⇒ déplacement apparent plus grand (perspective)
    expect(nearPlayer).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
    // Surtout : près du joueur, vitesse NON nulle / non effondrée
    expect(nearPlayer).toBeGreaterThan(0.5);
  });

  it('vitesse juste avant et juste après le plan joueur reste du même ordre', () => {
    const before = Math.abs(screenYSpeedForDz(2, maxZ, horizonY, playerY));
    const after = Math.abs(screenYSpeedForDz(-2, maxZ, horizonY, playerY));
    const ratio = Math.max(before, after) / Math.max(1e-6, Math.min(before, after));
    expect(ratio).toBeLessThan(3); // pas de rupture brutale
  });

  it('progress et exposant documentés', () => {
    expect(depthProgress(maxZ, maxZ)).toBeCloseTo(0, 5);
    expect(depthProgress(0, maxZ)).toBeCloseTo(1, 5);
    expect(Y_APPROACH_POWER).toBeGreaterThan(1);
  });

  it('roadHalf est linéaire en Y → bords de route droits', () => {
    const near = 156;
    const far = 22;
    const zs = [maxZ * 0.9, maxZ * 0.5, maxZ * 0.2, 5];
    const points = zs.map((z) => {
      const y = projectYContinuous(z, maxZ, horizonY, playerY);
      const half = roadHalfFromScreenY(y, horizonY, playerY, near, far);
      return { y, half };
    });
    // Colinéarité : (half - far) / (y - horizon) constant
    const slopes = points.map((p) => (p.half - far) / Math.max(1e-6, p.y - horizonY));
    for (let i = 1; i < slopes.length; i++) {
      expect(slopes[i]).toBeCloseTo(slopes[0], 5);
    }
  });

  it('roadHalf continue à croître sous playerY (t>1) — anti retour centre', () => {
    const near = 156;
    const far = 22;
    const atPlayer = roadHalfFromScreenY(playerY, horizonY, playerY, near, far);
    const below = roadHalfFromScreenY(playerY + 80, horizonY, playerY, near, far);
    expect(atPlayer).toBeCloseTo(near, 5);
    expect(below).toBeGreaterThan(near);
  });

  it('projectSceneryX : |x−center| croît quand z diminue (y compris z<0)', () => {
    const a = sceneryAbsCenterDelta(-1, 10, maxZ, 195, horizonY, playerY, 156, 22, 1.3, 8);
    const b = sceneryAbsCenterDelta(-1, -40, maxZ, 195, horizonY, playerY, 156, 22, 1.3, 8);
    expect(b).toBeGreaterThan(a);
    const xl = projectSceneryX(-1, -40, maxZ, 195, horizonY, playerY, 156, 22, 1.3, 8);
    const xr = projectSceneryX(1, -40, maxZ, 195, horizonY, playerY, 156, 22, 1.3, 8);
    expect(xl).toBeLessThan(195);
    expect(xr).toBeGreaterThan(195);
  });
});
