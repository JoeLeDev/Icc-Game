/** Configuration centralisée — Khayil 2026 */

export const GAME_W = 390;
export const GAME_H = 844;

export const LANES = 3;
export const LANE_X = [GAME_W * 0.22, GAME_W * 0.5, GAME_W * 0.78];

export const EQUIPMENTS = [
  { id: 'belt', name: 'Ceinture de vérité', short: 'Vérité', color: 0xffd54f },
  { id: 'breastplate', name: 'Cuirasse de la justice', short: 'Justice', color: 0xffca28 },
  { id: 'shoes', name: "Chaussures de l'Évangile", short: 'Paix', color: 0xffe082 },
  { id: 'shield', name: 'Bouclier de la foi', short: 'Foi', color: 0xffc107 },
  { id: 'helmet', name: 'Casque du salut', short: 'Salut', color: 0xffb300 },
  { id: 'sword', name: "Épée de l'Esprit", short: 'Parole', color: 0xffd740 },
  { id: 'prayer', name: 'Prière', short: 'Prière', color: 0xce93d8 },
] as const;

export type EquipmentId = (typeof EQUIPMENTS)[number]['id'];

export const BONUSES = [
  { id: 'magnet', name: 'Aimant', color: 0x00e5ff, duration: 6 },
  { id: 'shield', name: 'Bouclier', color: 0x69f0ae, duration: 0 }, // one-hit
  { id: 'life', name: 'Vie +1', color: 0xff4081, duration: 0 },
  { id: 'slowmo', name: 'Ralenti', color: 0xb388ff, duration: 5 },
  { id: 'boost', name: 'Boost', color: 0xff6e40, duration: 4 },
] as const;

export type BonusId = (typeof BONUSES)[number]['id'];

export const CONFIG = {
  player: {
    startLane: 1,
    yRatio: 0.78,
    laneSwitchDuration: 0.18,
    hitboxW: 42,
    hitboxH: 70,
    maxLives: 3,
    invincibilityDuration: 1.5,
  },

  speed: {
    base: 220,
    perEquipment: [0, 20, 45, 70, 110, 160, 220, 280],
    boostMultiplier: 1.55,
    slowmoMultiplier: 0.45,
    maxScroll: 560,
    finalPhaseDuration: 8,
  },

  spawn: {
    // Intervalle de base (secondes) selon équipements collectés (0–7)
    obstacleInterval: [2.8, 2.4, 2.0, 1.7, 1.4, 1.15, 0.95, 0.85],
    equipmentInterval: [4.2, 4.0, 3.8, 3.6, 3.4, 3.2, 3.0, 99],
    bonusInterval: [14, 13, 12, 11, 10, 9, 8, 12],
    attackInterval: [12, 10, 8, 6.5, 5.2, 4.2, 3.5, 2.8],
    loveChance: 0.04,
    minGapFront: 170,
    reactionTime: 1.2,
  },

  effects: {
    magnetRadius: 140,
    magnetPull: 380,
    loveDuration: 6,
    loveDestroyRadius: 160,
    boostProtects: true,
    // Cumul: nouveau pickup renouvelle la durée (refresh), ne stacke pas
    refreshOnPickup: true,
  },

  barrel: {
    fuseDuration: 2.4,
    blastRadius: 95,
    warningPulse: true,
  },

  laneClosure: {
    duration: 3.2,
    warningDuration: 1.0,
  },

  fear: {
    warningDuration: 0.9,
  },

  doubt: {
    // leurre qui disparaît au contact (pas de dégât) mais masque la voie
  },

  distraction: {
    duration: 2.5,
  },

  scoring: {
    distancePerMeter: 18,
    obstacleAvoidBonus: 5,
  },

  storage: {
    bestScoreKey: 'khayil2026_best',
    soundKey: 'khayil2026_sound',
    leaderboardKey: 'khayil2026_local_board',
  },
};

export type DifficultyTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function getTier(equipmentCount: number): DifficultyTier {
  return Math.min(7, Math.max(0, equipmentCount)) as DifficultyTier;
}

export function getScrollSpeed(equipmentCount: number, boost: boolean, slowmo: boolean): number {
  const base = CONFIG.speed.base + CONFIG.speed.perEquipment[getTier(equipmentCount)];
  let s = Math.min(base, CONFIG.speed.maxScroll);
  if (boost) s *= CONFIG.speed.boostMultiplier;
  if (slowmo) s *= CONFIG.speed.slowmoMultiplier;
  return s;
}
