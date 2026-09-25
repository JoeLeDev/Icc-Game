/**
 * Layout responsive — gameplay viewport plafonné + habillage desktop.
 * Les dimensions natives des PNG ne dictent jamais l’affichage.
 */

export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutMetrics {
  /** Canvas navigateur complet */
  browserWidth: number;
  browserHeight: number;
  /** Zone de gameplay (plafonnée sur desktop) */
  gameWidth: number;
  gameHeight: number;
  gameOffsetX: number;
  gameOffsetY: number;
  hasSideDressing: boolean;
  /** Alias gameplay (compat) */
  width: number;
  height: number;
  safe: SafeInsets;
  padTop: number;
  padBottom: number;
  padLeft: number;
  padRight: number;
  centerX: number;
  horizonY: number;
  playerY: number;
  nearRoadHalf: number;
  farRoadHalf: number;
  laneWidthNear: number;
  playerDisplayWidth: number;
  playerDisplayHeightMax: number;
  hudIconSize: number;
  hudHeartSize: number;
  worldEquipmentSize: number;
  worldBonusSize: number;
  worldLoveSize: number;
  worldCarHeight: number;
  worldTruckHeight: number;
  worldObstacleScale: number;
  propLampHeight: number;
  propPalmHeight: number;
  propTreeHeight: number;
  /** @deprecated alias de buildingNearHeight — référence premier plan */
  buildingBaseHeight: number;
  /** Hauteur bâtiment au premier plan (peut > viewport) */
  buildingNearHeight: number;
  /** Hauteur bâtiment à l’horizon */
  buildingFarHeight: number;
  buildingMinScale: number;
  buildingMaxScale: number;
  buildingMargin: number;
  /** Marge latérale FAR (fraction de roadHalf) */
  buildingLateralFactor: number;
  /** Marge latérale NEAR props */
  propLateralFactor: number;
  hudBarHeight: number;
  hudHeartStartX: number;
  hudHeartY: number;
  hudHeartGap: number;
  hudEqTextY: number;
  hudDistX: number;
  hudDistY: number;
  hudEffectsY: number;
  eqPanelX: number;
  eqIconStartY: number;
  eqIconGap: number;
  eqPanelHeight: number;
  pauseBtnX: number;
  pauseBtnY: number;
  pauseBtnSize: number;
  touchBtnSize: number;
  /** @deprecated préférer touchBtnLeftY / touchBtnRightY */
  touchBtnY: number;
  touchBtnLeftY: number;
  touchBtnRightY: number;
  touchBtnLeftX: number;
  touchBtnRightX: number;
  menuPlayerWidth: number;
  victoryPlayerWidth: number;
  gameOverPlayerWidth: number;
}

/** Ratios / bornes — pas de pixels « desktop only » */
export const LAYOUT_RULES = {
  /**
   * Largeur max du viewport gameplay.
   * Au-delà → habillage latéral, proportions inchangées.
   */
  GAMEPLAY_MAX_WIDTH: 640,
  /** Tablette : légèrement plus large que téléphone, sous le plafond desktop */
  GAMEPLAY_TABLET_SOFT_MAX: 560,

  PLAYER_LANE_RATIO: 0.72,
  PLAYER_WIDTH_MIN: 48,
  PLAYER_WIDTH_MAX: 128,
  PLAYER_HEIGHT_RATIO: 1.62,
  PLAYER_HEIGHT_MIN: 72,
  PLAYER_HEIGHT_MAX: 190,

  HUD_ICON_VIEWPORT_RATIO: 0.062,
  HUD_ICON_MIN: 22,
  HUD_ICON_MAX: 30,

  WORLD_EQUIP_LANE_RATIO: 0.36,
  WORLD_EQUIP_MIN: 30,
  WORLD_EQUIP_MAX: 48,

  TOUCH_BTN_WIDTH_RATIO: 0.145,
  TOUCH_BTN_MIN: 48,
  TOUCH_BTN_MAX: 68,
  TOUCH_SIDE_MARGIN: 14,
  TOUCH_BOTTOM_GAP: 10,
  /** Décalage vertical subtil gauche/droite (px) */
  CONTROLS_VERTICAL_OFFSET: 15,

  /**
   * Marge sous la moto (depuis bas gameplay − safe − demi-hauteur).
   * Indépendante des boutons tactiles.
   */
  PLAYER_BOTTOM_MARGIN: 26,

  HUD_TOP_GAP: 8,
  HUD_SIDE_GAP: 10,
  EQ_PANEL_GAP_FROM_SAFE: 6,

  NEAR_ROAD_HALF_RATIO: 0.4,
  FAR_ROAD_HALF_RATIO: 0.055,

  REF_LANE_WIDTH: 104,
} as const;

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Lit les safe areas iOS via un probe CSS (env(safe-area-inset-*)). */
export function readSafeAreaInsets(): SafeInsets {
  if (typeof document === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const el = document.getElementById('safe-area-probe');
  if (!el) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const cs = getComputedStyle(el);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

/**
 * Largeur du viewport gameplay :
 * - téléphone (≤500) : 100 % de la largeur
 * - tablette : min(largeur, 560) puis plafond 640
 * - desktop / ultrawide : plafonné à GAMEPLAY_MAX_WIDTH
 */
export function resolveGameWidth(browserWidth: number): number {
  const w = Math.max(280, browserWidth);
  if (w <= 500) return w;
  if (w <= 900) return Math.min(w, LAYOUT_RULES.GAMEPLAY_TABLET_SOFT_MAX);
  return Math.min(w, LAYOUT_RULES.GAMEPLAY_MAX_WIDTH);
}

export function computeLayout(
  browserWidth: number,
  browserHeight: number,
  safe: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 },
): LayoutMetrics {
  const bw = Math.max(280, browserWidth);
  const bh = Math.max(480, browserHeight);
  const gameWidth = resolveGameWidth(bw);
  const gameHeight = bh;
  const gameOffsetX = Math.round((bw - gameWidth) / 2);
  const gameOffsetY = 0;
  const hasSideDressing = gameOffsetX > 8;

  const w = gameWidth;
  const h = gameHeight;
  const aspect = w / h;

  const padTop = safe.top + LAYOUT_RULES.HUD_TOP_GAP;
  const padBottom = safe.bottom + LAYOUT_RULES.TOUCH_BOTTOM_GAP;
  // Pads relatifs au viewport gameplay (puis décalés par gameOffsetX)
  const padLeft = safe.left + LAYOUT_RULES.HUD_SIDE_GAP;
  const padRight = safe.right + LAYOUT_RULES.HUD_SIDE_GAP;

  const centerX = gameOffsetX + w * 0.5;
  const horizonRatio = aspect < 0.55 ? 0.27 : aspect < 0.75 ? 0.29 : aspect < 1.1 ? 0.3 : 0.32;
  const horizonY = gameOffsetY + h * horizonRatio;

  // Route proportionnelle au viewport gameplay uniquement (pas à la hauteur desktop)
  const maxRoadWidth = w * LAYOUT_RULES.NEAR_ROAD_HALF_RATIO * 2;
  const nearRoadHalf = maxRoadWidth / 2;
  const farRoadHalf =
    nearRoadHalf * (LAYOUT_RULES.FAR_ROAD_HALF_RATIO / LAYOUT_RULES.NEAR_ROAD_HALF_RATIO);
  const laneWidthNear = (nearRoadHalf * 2) / 3;

  const playerDisplayWidth = clamp(
    laneWidthNear * LAYOUT_RULES.PLAYER_LANE_RATIO,
    LAYOUT_RULES.PLAYER_WIDTH_MIN,
    LAYOUT_RULES.PLAYER_WIDTH_MAX,
  );
  const playerDisplayHeightMax = clamp(
    playerDisplayWidth * LAYOUT_RULES.PLAYER_HEIGHT_RATIO,
    LAYOUT_RULES.PLAYER_HEIGHT_MIN,
    LAYOUT_RULES.PLAYER_HEIGHT_MAX,
  );

  /**
   * Ancre joueur = bas du gameplay (pas un % hauteur).
   * playerY = centre du container moto.
   * Indépendant des boutons tactiles.
   */
  const gameplayBottom = gameOffsetY + h;
  const playerY = clamp(
    gameplayBottom -
      safe.bottom -
      playerDisplayHeightMax * 0.5 -
      LAYOUT_RULES.PLAYER_BOTTOM_MARGIN,
    horizonY + 140,
    gameplayBottom - safe.bottom - playerDisplayHeightMax * 0.5 - 8,
  );

  const hudIconSize = clamp(
    Math.min(w, h) * LAYOUT_RULES.HUD_ICON_VIEWPORT_RATIO,
    LAYOUT_RULES.HUD_ICON_MIN,
    LAYOUT_RULES.HUD_ICON_MAX,
  );
  const hudHeartSize = clamp(hudIconSize * 0.95, 20, 28);

  const worldEquipmentSize = clamp(
    laneWidthNear * LAYOUT_RULES.WORLD_EQUIP_LANE_RATIO,
    LAYOUT_RULES.WORLD_EQUIP_MIN,
    LAYOUT_RULES.WORLD_EQUIP_MAX,
  );
  const worldBonusSize = clamp(worldEquipmentSize * 0.86, 24, 48);
  const worldLoveSize = clamp(worldEquipmentSize * 1.05, 28, 52);

  const obstacleScale = laneWidthNear / LAYOUT_RULES.REF_LANE_WIDTH;
  const worldCarHeight = clamp(70 * obstacleScale, 48, 100);
  const worldTruckHeight = clamp(92 * obstacleScale, 60, 130);

  const touchBtnSize = clamp(
    w * LAYOUT_RULES.TOUCH_BTN_WIDTH_RATIO,
    LAYOUT_RULES.TOUCH_BTN_MIN,
    LAYOUT_RULES.TOUCH_BTN_MAX,
  );
  // Ancre contrôles (indépendante du joueur) — safe-area bottom respectée
  const controlsBaseY = gameplayBottom - padBottom - touchBtnSize * 0.5;
  const halfOff = LAYOUT_RULES.CONTROLS_VERTICAL_OFFSET * 0.5;
  const touchBtnLeftY = controlsBaseY - halfOff; // légèrement plus haut
  const touchBtnRightY = controlsBaseY + halfOff; // légèrement plus bas
  const touchBtnY = controlsBaseY;
  const touchBtnLeftX = gameOffsetX + padLeft + LAYOUT_RULES.TOUCH_SIDE_MARGIN + touchBtnSize * 0.5;
  const touchBtnRightX =
    gameOffsetX + w - padRight - LAYOUT_RULES.TOUCH_SIDE_MARGIN - touchBtnSize * 0.5;

  const hudBarHeight = padTop + 36;
  const hudHeartY = gameOffsetY + padTop + 16;
  const hudHeartStartX = gameOffsetX + padLeft + 14;
  const hudHeartGap = hudHeartSize + 8;
  const hudEqTextY = gameOffsetY + padTop + 10;
  const hudDistY = gameOffsetY + padTop + 16;
  const hudDistX = gameOffsetX + w - padRight - 52;
  const hudEffectsY = gameOffsetY + padTop + 34;

  const pauseBtnSize = clamp(w * 0.09, 30, 40);
  const pauseBtnX = gameOffsetX + w - padRight - pauseBtnSize * 0.55 - 4;
  const pauseBtnY = gameOffsetY + padTop + 16;

  const roadLeftEdge = centerX - nearRoadHalf;
  const eqPanelX = clamp(
    gameOffsetX + padLeft + hudIconSize * 0.55 + LAYOUT_RULES.EQ_PANEL_GAP_FROM_SAFE,
    gameOffsetX + padLeft + 14,
    roadLeftEdge - hudIconSize * 0.7 - 4,
  );
  const eqIconStartY = gameOffsetY + hudBarHeight + 18;
  const eqIconGap = clamp(hudIconSize + 10, 30, 42);
  const eqPanelHeight = 7 * eqIconGap + 12;

  const menuPlayerWidth = clamp(w * 0.24, 72, 120);
  const victoryPlayerWidth = clamp(w * 0.22, 68, 110);
  const gameOverPlayerWidth = clamp(w * 0.2, 60, 96);

  return {
    browserWidth: bw,
    browserHeight: bh,
    gameWidth,
    gameHeight,
    gameOffsetX,
    gameOffsetY,
    hasSideDressing,
    width: w,
    height: h,
    safe: { ...safe },
    padTop,
    padBottom,
    padLeft,
    padRight,
    centerX,
    horizonY,
    playerY,
    nearRoadHalf,
    farRoadHalf,
    laneWidthNear,
    playerDisplayWidth,
    playerDisplayHeightMax,
    hudIconSize,
    hudHeartSize,
    worldEquipmentSize,
    worldBonusSize,
    worldLoveSize,
    worldCarHeight,
    worldTruckHeight,
    worldObstacleScale: obstacleScale,
    propLampHeight: clamp(bh * 0.155, 100, 155),
    propPalmHeight: clamp(bh * 0.2, 120, 190),
    propTreeHeight: clamp(bh * 0.22, 130, 200),
    // Murs de ville imposants mais coherents avec palm/lamp (~430–560 @ 1440×900)
    buildingNearHeight: clamp(bh * 0.55, 430, 560),
    buildingFarHeight: clamp(bh * 0.07, 48, 72),
    buildingBaseHeight: clamp(bh * 0.55, 430, 560),
    buildingMinScale: 0.08,
    buildingMaxScale: 1,
    buildingMargin: clamp(18 * obstacleScale, 14, 36),
    buildingLateralFactor: 0.62,
    propLateralFactor: 0.14,
    hudBarHeight,
    hudHeartStartX,
    hudHeartY,
    hudHeartGap,
    hudEqTextY,
    hudDistX,
    hudDistY,
    hudEffectsY,
    eqPanelX,
    eqIconStartY,
    eqIconGap,
    eqPanelHeight,
    pauseBtnX,
    pauseBtnY,
    pauseBtnSize,
    touchBtnSize,
    touchBtnY,
    touchBtnLeftY,
    touchBtnRightY,
    touchBtnLeftX,
    touchBtnRightX,
    menuPlayerWidth,
    victoryPlayerWidth,
    gameOverPlayerWidth,
  };
}

let currentLayout: LayoutMetrics = computeLayout(390, 844);

export function setCurrentLayout(layout: LayoutMetrics): void {
  currentLayout = layout;
}

export function getCurrentLayout(): LayoutMetrics {
  return currentLayout;
}

/** Viewports de vérification (9 résolutions demandées) */
export const TEST_VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667, safe: { top: 20, right: 0, bottom: 0, left: 0 } },
  { name: 'iPhone 12/13', width: 390, height: 844, safe: { top: 47, right: 0, bottom: 34, left: 0 } },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932, safe: { top: 59, right: 0, bottom: 34, left: 0 } },
  { name: 'iPhone large', width: 444, height: 960, safe: { top: 59, right: 0, bottom: 34, left: 0 } },
  { name: 'iPad portrait', width: 768, height: 1024, safe: { top: 24, right: 0, bottom: 20, left: 0 } },
  { name: 'Laptop', width: 1366, height: 768, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'Desktop', width: 1440, height: 900, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'Full HD', width: 1920, height: 1080, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'Ultrawide QHD', width: 2560, height: 1440, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
] as const;
