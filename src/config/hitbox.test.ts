import { describe, expect, it } from 'vitest';
import {
  HIT_INSETS,
  aabbOverlap,
  estimateVisualContactZ,
  hitRectForRole,
  makeHitRect,
} from '../systems/Hitbox';
import { LAYOUT_RULES, TEST_VIEWPORTS, computeLayout } from './responsiveLayout';

describe('Hitbox display ↔ body', () => {
  const playerSizes = [44, 60, 62, 71, 90, 102, 120];

  for (const pw of playerSizes) {
    it(`moto ${pw}px : hitbox plus petite que le display, centrée`, () => {
      const ph = pw * 1.5;
      const hit = hitRectForRole(200, 600, pw, ph, 'player');
      expect(hit.w).toBeLessThan(pw);
      expect(hit.h).toBeLessThan(ph);
      expect(hit.w).toBeCloseTo(pw * (1 - 2 * HIT_INSETS.player.x), 5);
      expect(hit.x).toBe(200);
      expect(hit.y).toBe(600);
      // Pas une hitbox géante artificielle
      expect(hit.w / pw).toBeGreaterThan(0.45);
      expect(hit.w / pw).toBeLessThan(0.75);
    });
  }

  it('équipement : hitbox suit le displaySize, pas le PNG 160×160', () => {
    const display = 42;
    const hit = hitRectForRole(100, 500, display, display, 'equipment');
    expect(hit.w).toBeLessThanOrEqual(display);
    expect(hit.w).toBeGreaterThan(display * 0.5);
    expect(hit.w).toBeLessThan(80);
  });

  it('obstacle : hitbox proportionnelle au display', () => {
    const hit = hitRectForRole(150, 400, 56, 70, 'obstacle');
    expect(hit.w).toBeCloseTo(56 * (1 - 2 * HIT_INSETS.obstacle.x), 5);
    expect(hit.h).toBeCloseTo(70 * (1 - 2 * HIT_INSETS.obstacle.y), 5);
  });

  it('overlap dès le premier contact AABB (même frame)', () => {
    const player = hitRectForRole(200, 600, 62, 93, 'player');
    const eqH = 40 * (1 - 2 * HIT_INSETS.equipment.y);
    const contactY = player.top - eqH / 2 + 1;
    const eq = hitRectForRole(200, contactY, 40, 40, 'equipment');
    expect(aabbOverlap(player, eq)).toBe(true);

    const far = hitRectForRole(200, player.top - 80, 40, 40, 'equipment');
    expect(aabbOverlap(player, far)).toBe(false);
  });

  it('l’ancien seuil z≤30 est trop tardif vs contact visuel', () => {
    const zContact = estimateVisualContactZ({
      maxZ: 420,
      playerY: 650,
      horizonY: 250,
      playerHitH: 70,
      equipHitH: 36,
    });
    expect(zContact).toBeGreaterThan(30);
    expect(zContact).toBeGreaterThan(80);
  });

  it('pas d’overlap si voies différentes (centres éloignés)', () => {
    const player = hitRectForRole(195, 600, 62, 93, 'player');
    const otherLane = hitRectForRole(300, 600, 42, 42, 'equipment');
    expect(aabbOverlap(player, otherLane)).toBe(false);
  });
});

describe('Gameplay viewport plafonné', () => {
  const wide = [
    { name: '1366×768', width: 1366, height: 768 },
    { name: '1440×900', width: 1440, height: 900 },
    { name: '1920×1080', width: 1920, height: 1080 },
    { name: '2560×1440', width: 2560, height: 1440 },
  ];

  for (const vp of wide) {
    it(`${vp.name} : gameWidth ≤ max, offset centré, habillage latéral`, () => {
      const L = computeLayout(vp.width, vp.height);
      expect(L.gameWidth).toBeLessThanOrEqual(LAYOUT_RULES.GAMEPLAY_MAX_WIDTH);
      expect(L.gameWidth).toBeLessThan(vp.width);
      expect(L.gameOffsetX).toBeCloseTo((vp.width - L.gameWidth) / 2, 5);
      expect(L.hasSideDressing).toBe(true);
      expect(L.laneWidthNear).toBeLessThan(180);
    });
  }

  it('mobile : gameplay ≈ pleine largeur', () => {
    for (const w of [375, 390, 430, 444]) {
      const L = computeLayout(w, 844);
      expect(L.gameWidth).toBe(w);
      expect(L.gameOffsetX).toBe(0);
      expect(L.hasSideDressing).toBe(false);
    }
  });

  it('proportions gameplay stables entre 1440 et 2560', () => {
    const a = computeLayout(1440, 900);
    const b = computeLayout(2560, 1440);
    expect(Math.abs(a.gameWidth - b.gameWidth)).toBeLessThan(1);
    expect(Math.abs(a.laneWidthNear - b.laneWidthNear)).toBeLessThan(1);
    expect(Math.abs(a.playerDisplayWidth - b.playerDisplayWidth)).toBeLessThan(1);
  });
});

describe('computeLayout — viewports demandés', () => {
  for (const vp of TEST_VIEWPORTS) {
    it(`${vp.name} (${vp.width}×${vp.height})`, () => {
      const L = computeLayout(vp.width, vp.height, { ...vp.safe });
      const ratio = L.playerDisplayWidth / L.laneWidthNear;
      expect(ratio).toBeGreaterThanOrEqual(0.55);
      expect(ratio).toBeLessThanOrEqual(0.65);
      expect(L.hudIconSize).toBeLessThanOrEqual(30);
      expect(L.centerX).toBeCloseTo(L.gameOffsetX + L.gameWidth / 2, 5);
    });
  }
});
