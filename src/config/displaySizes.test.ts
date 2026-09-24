import { describe, expect, it } from 'vitest';
import { DISPLAY } from './displaySizes';
import { LAYOUT_RULES, TEST_VIEWPORTS, computeLayout } from './responsiveLayout';

describe('DISPLAY proportions (référence)', () => {
  it('sépare clairement HUD et monde pour les équipements', () => {
    expect(DISPLAY.HUD_EQUIPMENT_ICON_SIZE).toBeLessThan(DISPLAY.WORLD_EQUIPMENT_SIZE);
  });

  it('définit une plage d’échelle pour les bâtiments latéraux', () => {
    expect(DISPLAY.ROADSIDE_BUILDING_MIN_SCALE).toBeLessThan(DISPLAY.ROADSIDE_BUILDING_MAX_SCALE);
    expect(DISPLAY.ROADSIDE_BUILDING_MIN_SCALE).toBeGreaterThan(0);
  });
});

describe('computeLayout — viewports', () => {
  for (const vp of TEST_VIEWPORTS) {
    describe(`${vp.name} (${vp.width}×${vp.height})`, () => {
      const L = computeLayout(vp.width, vp.height, { ...vp.safe });

      it('moto = 68–75 % d’une voie', () => {
        const ratio = L.playerDisplayWidth / L.laneWidthNear;
        expect(ratio).toBeGreaterThanOrEqual(0.68);
        expect(ratio).toBeLessThanOrEqual(0.75);
      });

      it('icônes HUD clampées', () => {
        expect(L.hudIconSize).toBeGreaterThanOrEqual(LAYOUT_RULES.HUD_ICON_MIN);
        expect(L.hudIconSize).toBeLessThanOrEqual(LAYOUT_RULES.HUD_ICON_MAX);
        expect(L.hudIconSize).toBeLessThan(L.worldEquipmentSize);
      });

      it('HUD sous la safe area', () => {
        expect(L.hudHeartY).toBeGreaterThan(L.safe.top);
        expect(L.pauseBtnY).toBeGreaterThan(L.safe.top);
      });

      it('contrôles dans le viewport gameplay', () => {
        expect(L.touchBtnLeftX).toBeGreaterThanOrEqual(L.gameOffsetX);
        expect(L.touchBtnRightX).toBeLessThanOrEqual(L.gameOffsetX + L.gameWidth);
        expect(L.touchBtnSize).toBeLessThanOrEqual(LAYOUT_RULES.TOUCH_BTN_MAX);
        expect(L.touchBtnLeftY).toBeLessThan(L.touchBtnRightY);
        expect(L.touchBtnRightY - L.touchBtnLeftY).toBeCloseTo(LAYOUT_RULES.CONTROLS_VERTICAL_OFFSET, 5);
        expect(L.touchBtnRightY + L.touchBtnSize * 0.5).toBeLessThanOrEqual(
          L.gameOffsetY + L.gameHeight - L.safe.bottom + 1,
        );
      });

      it('moto ancrée en bas (pas un % hauteur)', () => {
        const expected =
          L.gameOffsetY +
          L.gameHeight -
          L.safe.bottom -
          L.playerDisplayHeightMax * 0.5 -
          LAYOUT_RULES.PLAYER_BOTTOM_MARGIN;
        expect(L.playerY).toBeCloseTo(
          Math.max(L.horizonY + 140, Math.min(expected, L.gameOffsetY + L.gameHeight - L.safe.bottom - L.playerDisplayHeightMax * 0.5 - 8)),
          5,
        );
        // Entièrement visible au-dessus du bas − safe
        expect(L.playerY + L.playerDisplayHeightMax * 0.5).toBeLessThanOrEqual(
          L.gameOffsetY + L.gameHeight - L.safe.bottom + 0.5,
        );
        // Sur portrait haut : reste basse (< 12 % du bas), pas remonter avec h
        const fromBottom = L.gameOffsetY + L.gameHeight - L.playerY;
        expect(fromBottom).toBeLessThan(L.gameHeight * 0.22);
        expect(fromBottom).toBeGreaterThan(L.playerDisplayHeightMax * 0.45);
      });

      it('route centrée dans le gameplay viewport', () => {
        expect(L.centerX).toBeCloseTo(L.gameOffsetX + L.gameWidth / 2, 5);
        const roadLeft = L.centerX - L.nearRoadHalf;
        expect(L.eqPanelX + L.hudIconSize / 2).toBeLessThanOrEqual(roadLeft + 2);
      });

      it('gameWidth plafonné correctement', () => {
        expect(L.gameWidth).toBeLessThanOrEqual(LAYOUT_RULES.GAMEPLAY_MAX_WIDTH);
        if (vp.width <= 500) {
          expect(L.gameWidth).toBe(vp.width);
          expect(L.hasSideDressing).toBe(false);
        }
        if (vp.width >= 1366) {
          expect(L.hasSideDressing).toBe(true);
          expect(L.gameWidth).toBe(LAYOUT_RULES.GAMEPLAY_MAX_WIDTH);
        }
      });
    });
  }
});
