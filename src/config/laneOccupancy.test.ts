import { describe, expect, it } from 'vitest';
import {
  HORIZON_FADE_END,
  HORIZON_FADE_START,
  LANE_OCCUPANCY,
  horizonFadeAlpha,
  horizonSpawnZ,
  occupancyRoleForKey,
  targetWidthForLane,
} from './laneOccupancy';
import { computeLayout } from './responsiveLayout';

describe('laneOccupancy', () => {
  it('hiérarchie véhicule > équipement', () => {
    expect(LANE_OCCUPANCY.car).toBeGreaterThan(LANE_OCCUPANCY.equipment);
    expect(LANE_OCCUPANCY.truck).toBeGreaterThan(LANE_OCCUPANCY.car);
    expect(LANE_OCCUPANCY.motorcycle).toBeGreaterThanOrEqual(0.68);
    expect(LANE_OCCUPANCY.motorcycle).toBeLessThanOrEqual(0.75);
  });

  it('mappe les clés logiques', () => {
    expect(occupancyRoleForKey('car')).toBe('car');
    expect(occupancyRoleForKey('eq-belt')).toBe('equipment');
    expect(occupancyRoleForKey('cone')).toBe('smallObstacle');
    expect(occupancyRoleForKey('barrel')).toBe('largeObstacle');
  });

  it('spawn horizon proche de maxZ', () => {
    expect(horizonSpawnZ(420)).toBeCloseTo(420 * HORIZON_FADE_START, 5);
  });

  it('fade-in horizon : 0 au spawn, 1 après intro', () => {
    const maxZ = 420;
    expect(horizonFadeAlpha(maxZ * HORIZON_FADE_START, maxZ)).toBe(0);
    expect(horizonFadeAlpha(maxZ * HORIZON_FADE_END, maxZ)).toBe(1);
    expect(horizonFadeAlpha(maxZ * 0.5, maxZ)).toBe(1);
    const mid = (HORIZON_FADE_START + HORIZON_FADE_END) / 2;
    expect(horizonFadeAlpha(maxZ * mid, maxZ)).toBeGreaterThan(0.2);
    expect(horizonFadeAlpha(maxZ * mid, maxZ)).toBeLessThan(0.8);
  });

  it('moto remplit ~72 % de la voie sur les résolutions clés', () => {
    for (const [w, h, safe] of [
      [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }],
      [430, 932, { top: 59, right: 0, bottom: 34, left: 0 }],
      [1440, 900, { top: 0, right: 0, bottom: 0, left: 0 }],
    ] as const) {
      const L = computeLayout(w, h, { ...safe });
      const ratio = L.playerDisplayWidth / L.laneWidthNear;
      expect(ratio).toBeCloseTo(LANE_OCCUPANCY.motorcycle, 2);
      expect(targetWidthForLane(L.laneWidthNear, 'car') / L.laneWidthNear).toBeCloseTo(
        LANE_OCCUPANCY.car,
        5,
      );
    }
  });
});
