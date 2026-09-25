import { describe, expect, it } from 'vitest';
import {
  OFFSCREEN_MARGIN,
  PASSED_EXIT_SPAN,
  PLAYER_PLANE_Z,
  isFullyOffscreen,
  passedExitT,
  roadsidePhase,
  roadsideScrollMul,
} from './roadsideLifecycle';
import { buildingDisplayHeight } from './roadsideScale';
import { RoadProjection } from '../systems/RoadProjection';
import { computeLayout } from './responsiveLayout';

describe('roadsideLifecycle — phases', () => {
  it('PASSED quand z <= plan joueur', () => {
    expect(roadsidePhase(0, 420)).toBe('PASSED');
    expect(roadsidePhase(-10, 420)).toBe('PASSED');
    expect(PLAYER_PLANE_Z).toBe(0);
  });

  it('FAR / APPROACHING / NEAR selon z', () => {
    expect(roadsidePhase(400, 420)).toBe('FAR');
    expect(roadsidePhase(200, 420)).toBe('APPROACHING');
    expect(roadsidePhase(50, 420)).toBe('NEAR');
  });

  it('scroll constant par bande (pas de saut de phase)', () => {
    expect(roadsideScrollMul('PASSED', 'near')).toBe(roadsideScrollMul('FAR', 'near'));
    expect(roadsideScrollMul('NEAR', 'far')).toBeLessThan(roadsideScrollMul('NEAR', 'near'));
  });
});

describe('roadsideLifecycle — offscreen', () => {
  it('détecte bounds hors viewport avec marge', () => {
    expect(
      isFullyOffscreen({ left: -200, right: -100, top: 10, bottom: 50 }, 390, 844, OFFSCREEN_MARGIN),
    ).toBe(true);
    expect(
      isFullyOffscreen({ left: 100, right: 200, top: 100, bottom: 200 }, 390, 844, OFFSCREEN_MARGIN),
    ).toBe(false);
  });
});

describe('projectDecor — PASSED continue Y + roadHalf (pas de freeze centre)', () => {
  it('y et roadHalf croissent après le plan joueur (sortie bas-extérieur)', () => {
    const L = computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    const proj = new RoadProjection();
    proj.applyLayout(L);
    const atPlayer = proj.projectDecor(0);
    const passed = proj.projectDecor(-PASSED_EXIT_SPAN);
    expect(passed.y).toBeGreaterThan(atPlayer.y);
    // roadHalf DOIT croître (sinon retour visuel vers le centre vs trapèze route)
    expect(passed.roadHalf).toBeGreaterThan(atPlayer.roadHalf);
    expect(passed.exitT).toBeCloseTo(1, 5);
    expect(passedExitT(-45)).toBeCloseTo(45 / PASSED_EXIT_SPAN, 5);
  });

  it('gameplay roadHalfAt reste figé en z<0 (lanes / obstacles)', () => {
    const L = computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    const proj = new RoadProjection();
    proj.applyLayout(L);
    expect(proj.roadHalfAt(-PASSED_EXIT_SPAN)).toBeCloseTo(proj.nearRoadHalf, 5);
    expect(proj.decorRoadHalfAt(-PASSED_EXIT_SPAN)).toBeGreaterThan(proj.nearRoadHalf);
  });

  it('échelle bâtiment quasi figée en PASSED (sortie verticale)', () => {
    const near = 500;
    const far = 60;
    const at0 = buildingDisplayHeight(0, 420, near, far);
    const past = buildingDisplayHeight(-40, 420, near, far);
    expect(past).toBeGreaterThanOrEqual(at0);
    expect(past / at0).toBeLessThan(1.2);
  });
});
