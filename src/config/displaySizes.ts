/**
 * Constantes d’affichage de référence + règles.
 * Les tailles runtime viennent de `computeLayout()` (responsive).
 * Ne jamais utiliser les dimensions natives des PNG comme taille finale.
 */
export { LAYOUT_RULES } from './responsiveLayout';
export type { LayoutMetrics, SafeInsets } from './responsiveLayout';

/** Valeurs de référence @390×844 — préférer getCurrentLayout() en jeu. */
export const DISPLAY = {
  /** @deprecated préférer layout.playerDisplayWidth */
  PLAYER_DISPLAY_WIDTH: 62,
  PLAYER_DISPLAY_HEIGHT_MAX: 100,
  HUD_EQUIPMENT_ICON_SIZE: 28,
  WORLD_EQUIPMENT_SIZE: 42,
  WORLD_BONUS_SIZE: 36,
  WORLD_LOVE_SIZE: 44,
  WORLD_CAR_HEIGHT: 70,
  WORLD_TRUCK_HEIGHT: 92,
  WORLD_BARREL_HEIGHT: 42,
  WORLD_BARRIER_HEIGHT: 24,
  WORLD_CONE_HEIGHT: 32,
  WORLD_HOLE_HEIGHT: 24,
  WORLD_DEPRESSION_HEIGHT: 50,
  WORLD_CALOMNIE_HEIGHT: 38,
  WORLD_PEUR_HEIGHT: 60,
  WORLD_DOUTE_HEIGHT: 40,
  WORLD_COLERE_HEIGHT: 46,
  WORLD_PROJECTILE_HEIGHT: 12,
  WORLD_REJECT_HEIGHT: 28,
  PROP_LAMP_HEIGHT: 110,
  PROP_PALM_HEIGHT: 130,
  ROADSIDE_BUILDING_MIN_SCALE: 0.08,
  ROADSIDE_BUILDING_MAX_SCALE: 1,
  ROADSIDE_BUILDING_BASE_HEIGHT: 700,
  ROADSIDE_BUILDING_MARGIN: 22,
  MENU_PLAYER_WIDTH: 96,
  VICTORY_PLAYER_WIDTH: 90,
  GAMEOVER_PLAYER_WIDTH: 78,
} as const;

/** Bâtiments isolés (1 objet / PNG) — placement G/D + flipX côté Phaser */
export const ROADSIDE_BUILDING_KEYS = [
  'building_01',
  'building_02',
  'building_03',
] as const;

export type RoadsideBuildingKey = (typeof ROADSIDE_BUILDING_KEYS)[number];
