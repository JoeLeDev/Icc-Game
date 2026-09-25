import { describe, expect, it } from 'vitest';
import {
  HIT_INSETS,
  aabbOverlap,
  aabbSweptOverlap,
  estimateNearScreenDeltaY,
  hitRectForRole,
} from '../systems/Hitbox';
import { computeLayout } from './responsiveLayout';

/** QA visuelle → tests de contact bord/centre + tunneling */

describe('Insets dérivés des PNG (mesures alpha)', () => {
  it('moto : inset X ≈ marge transparente 16 %, Y faible', () => {
    expect(HIT_INSETS.player.x).toBeGreaterThanOrEqual(0.12);
    expect(HIT_INSETS.player.x).toBeLessThanOrEqual(0.18);
    expect(HIT_INSETS.player.y).toBeLessThanOrEqual(0.06);
  });

  it('équipement : insets < anciennes valeurs arbitraires 0.16', () => {
    expect(HIT_INSETS.equipment.x).toBeLessThanOrEqual(0.12);
    expect(HIT_INSETS.equipment.y).toBeLessThanOrEqual(0.12);
  });

  it('hitbox moto occupe ~70 % largeur display (contenu opaque)', () => {
    const hit = hitRectForRole(0, 0, 62, 93, 'player');
    expect(hit.w / 62).toBeCloseTo(1 - 2 * HIT_INSETS.player.x, 5);
    expect(hit.w / 62).toBeGreaterThan(0.65);
    expect(hit.w / 62).toBeLessThan(0.8);
  });
});

describe('Contacts bord / centre / avant', () => {
  const playerSizes = [60, 62, 71, 90, 102];

  for (const pw of playerSizes) {
    const ph = pw * 1.5;
    const player = hitRectForRole(200, 600, pw, ph, 'player');
    const eqSize = Math.round(pw * 0.65);

    it(`moto ${pw}px — centre : overlap immédiat`, () => {
      const eq = hitRectForRole(200, player.top + 2, eqSize, eqSize, 'equipment');
      expect(aabbOverlap(player, eq)).toBe(true);
    });

    it(`moto ${pw}px — bord gauche : contact crédible`, () => {
      // centre équipement sur le bord gauche de la hitbox moto
      const eq = hitRectForRole(player.left, player.y - player.h * 0.15, eqSize, eqSize, 'equipment');
      expect(aabbOverlap(player, eq)).toBe(true);
    });

    it(`moto ${pw}px — bord droit : contact crédible`, () => {
      const eq = hitRectForRole(player.right, player.y - player.h * 0.15, eqSize, eqSize, 'equipment');
      expect(aabbOverlap(player, eq)).toBe(true);
    });

    it(`moto ${pw}px — avant (haut) : contact dès entrée dans la hitbox`, () => {
      const eqH = eqSize * (1 - 2 * HIT_INSETS.equipment.y);
      const eq = hitRectForRole(200, player.top - eqH / 2 + 1, eqSize, eqSize, 'equipment');
      expect(aabbOverlap(player, eq)).toBe(true);
      const justMiss = hitRectForRole(200, player.top - eqH / 2 - 2, eqSize, eqSize, 'equipment');
      expect(aabbOverlap(player, justMiss)).toBe(false);
    });

    it(`moto ${pw}px — obstacle frôlé latéralement : pas de hit`, () => {
      const obs = hitRectForRole(player.right + 40, player.y, 50, 60, 'obstacle');
      expect(aabbOverlap(player, obs)).toBe(false);
    });
  }
});

describe('Anti-tunneling 30/60 FPS', () => {
  const player = hitRectForRole(200, 600, 62, 93, 'player');
  const eqSize = 42;

  it('à 60 FPS / speed 400 : delta Y << hauteur hitbox combinée', () => {
    const dy = estimateNearScreenDeltaY({
      scrollSpeed: 400,
      dt: 1 / 60,
      z: 140,
      maxZ: 420,
      playerY: 650,
      horizonY: 250,
    });
    const eq = hitRectForRole(0, 0, eqSize, eqSize, 'equipment');
    expect(dy).toBeLessThan(player.h / 2 + eq.h / 2);
  });

  it('à 30 FPS / speed 400 : delta Y encore sous le seuil de tunneling', () => {
    const dy = estimateNearScreenDeltaY({
      scrollSpeed: 400,
      dt: 1 / 30,
      z: 140,
      maxZ: 420,
      playerY: 650,
      horizonY: 250,
    });
    const eq = hitRectForRole(0, 0, eqSize, eqSize, 'equipment');
    expect(dy).toBeLessThan(player.h / 2 + eq.h / 2);
  });

  it('swept AABB attrape un saut qui traverse la hitbox entre deux frames', () => {
    const eqH = eqSize * (1 - 2 * HIT_INSETS.equipment.y);
    // Frame N : juste au-dessus (pas encore contact)
    const from = hitRectForRole(200, player.top - eqH / 2 - 5, eqSize, eqSize, 'equipment');
    // Frame N+1 : déjà passé sous le centre (aurait tunnelé sans swept)
    const to = hitRectForRole(200, player.y + 10, eqSize, eqSize, 'equipment');
    expect(aabbOverlap(player, from)).toBe(false);
    // to overlaps or is past — swept must catch
    expect(aabbSweptOverlap(player, from, to)).toBe(true);
  });

  it('responsive desktop 640 : mêmes ratios de contact', () => {
    const L = computeLayout(1920, 1080);
    expect(L.gameWidth).toBe(640);
    const p = hitRectForRole(L.centerX, L.playerY, L.playerDisplayWidth, L.playerDisplayHeightMax, 'player');
    const eq = hitRectForRole(
      L.centerX,
      p.top + 2,
      L.worldEquipmentSize,
      L.worldEquipmentSize,
      'equipment',
    );
    expect(aabbOverlap(p, eq)).toBe(true);
  });
});

describe('Régression : pas de hitbox géante', () => {
  it('moto/équipement restent sous le display', () => {
    for (const pw of [44, 62, 102]) {
      const p = hitRectForRole(0, 0, pw, pw * 1.5, 'player');
      expect(p.w).toBeLessThan(pw);
      expect(p.h).toBeLessThan(pw * 1.5);
    }
    const e = hitRectForRole(0, 0, 42, 42, 'equipment');
    expect(e.w).toBeLessThan(42);
  });
});
