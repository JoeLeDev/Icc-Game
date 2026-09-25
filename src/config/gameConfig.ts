/** Configuration centralisée — Khayil 2026 (rééquilibrage casual) */

import type { DifficultyId, DifficultyPreset } from './difficulty';
import { DEFAULT_DIFFICULTY, getDifficultyPreset } from './difficulty';

export const GAME_W = 390;
export const GAME_H = 844;
/** Ratio logique du jeu (utilisé aussi côté CSS) */
export const GAME_ASPECT = GAME_W / GAME_H;

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
  { id: 'magnet', name: 'Aimant', color: 0x00e5ff, duration: 7 },
  { id: 'shield', name: 'Bouclier', color: 0x69f0ae, duration: 0 },
  { id: 'life', name: 'Vie +1', color: 0xff4081, duration: 0 },
  { id: 'slowmo', name: 'Ralenti', color: 0xb388ff, duration: 5.5 },
  { id: 'boost', name: 'Boost', color: 0xff6e40, duration: 3.5 },
] as const;

export type BonusId = (typeof BONUSES)[number]['id'];

/**
 * Cible design : partie gagnante ~90–150 s (à valider en playtest téléphone).
 * Les tableaux sont indexés par getTier(équipements distincts) ∈ [0..7].
 */
export const CONFIG = {
  player: {
    startLane: 1,
    yRatio: 0.78,
    laneSwitchDuration: 0.2,
    hitboxW: 42,
    hitboxH: 70,
    maxLives: 3,
    /** Fenêtre après impact pour éviter les chaînes de vies */
    invincibilityDuration: 2.2,
    startInvincibility: 2.5,
  },

  speed: {
    base: 155,
    /** Progression douce — ne double pas la densité en même temps */
    perEquipment: [0, 6, 14, 24, 38, 55, 75, 100],
    boostMultiplier: 1.32,
    slowmoMultiplier: 0.55,
    maxScroll: 400,
    finalPhaseDuration: 10,
  },

  spawn: {
    /** Intro calme : premiers obstacles espacés */
    obstacleInterval: [2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5],
    /** ~7 équipements répartis sur ~90–130 s si peu de ratés */
    equipmentInterval: [15, 14.5, 14, 13.5, 13, 12.5, 12, 99],
    /** Délai avant le 1er équipement (apprentissage déplacement) */
    firstEquipmentDelay: 7,
    bonusInterval: [8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5],
    /** Attaques — démarrage plus tôt, cadence plus élevée (ennemis moto) */
    attackInterval: [99, 5, 4.5, 4, 3.5, 3, 2.5, 2],
    loveChance: 0.028,
    minGapFront: 200,
    /** Temps de réaction joueur avant la zone dangereuse */
    reactionTime: 1.35,
    /** Marge de sécurité en unités monde autour d’un spawn */
    safetyBand: 95,
    /** Respiration après une attaque (ralentit obstacle + prochaine attaque) */
    breathAfterAttack: 1.5,
    /** Chance de pattern 2 voies (jamais 3) — plus agressif pour la difficulté */
    doubleBlockChance: [0.12, 0.18, 0.28, 0.36, 0.42, 0.48, 0.52, 0.55],
    /**
     * @deprecated Préférer ObstacleLaneDistributor + ciblage joueur.
     * Conservé pour compat tests legacy — valeur neutre.
     */
    middleLaneBias: 1 / 3,
    maxSpawnsWithoutMiddle: 3,
    playerLaneTargetChance: 0.45,
    /**
     * Obstacles / dangers plus proches que ce Z bloquent le spawn moto sur leur voie
     * et réservent toujours 1 voie d’échappatoire.
     */
    motoClearanceZ: 260,
    /** Après un double obstacle : délai mini avant prochaine attaque moto (s) */
    attackDelayAfterDouble: 2.8,
  },

  /** Déblocage progressif des familles d’attaques */
  attackUnlock: {
    doute: { minTier: 1, minTime: 18 },
    depression: { minTier: 1, minTime: 14 },
    calomnie: { minTier: 2, minTime: 36 },
    colere: { minTier: 3, minTime: 50 },
    peur: { minTier: 2, minTime: 24 },
    reject: { minTier: 4, minTime: 72 },
    distraction: { minTier: 4, minTime: 78 },
    fromBehind: { minTier: 5, minTime: 88 },
  } as const,

  effects: {
    magnetRadius: 150,
    magnetPull: 340,
    loveDuration: 6.5,
    loveDestroyRadius: 170,
    boostProtects: true,
    refreshOnPickup: true,
    /** Si boost + ralenti actifs : le ralenti gagne sur la vitesse affichée */
    slowmoOverridesBoost: true,
  },

  barrel: {
    fuseDuration: 2.8,
    blastRadius: 90,
  },

  laneClosure: {
    duration: 2.8,
    warningDuration: 1.35,
  },

  fear: {
    warningDuration: 1.15,
  },

  distraction: {
    duration: 2.0,
  },

  scoring: {
    distancePerMeter: 16,
  },

  storage: {
    bestScoreKey: 'khayil2026_best',
    soundKey: 'khayil2026_sound',
    leaderboardKey: 'khayil2026_local_board',
    difficultyKey: 'khayil2026_difficulty',
  },
};

export type DifficultyTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type AttackFamily = keyof typeof CONFIG.attackUnlock;

export function getTier(equipmentCount: number): DifficultyTier {
  return Math.min(7, Math.max(0, equipmentCount)) as DifficultyTier;
}

/**
 * Vitesse de défilement (px/s).
 * Ralenti prioritaire sur boost si les deux sont actifs.
 * La difficulté multiplie la base puis respecte maxScroll × maxScrollMul.
 */
export function getScrollSpeed(
  equipmentCount: number,
  boost: boolean,
  slowmo: boolean,
  difficulty: DifficultyId | DifficultyPreset = DEFAULT_DIFFICULTY,
): number {
  const preset = typeof difficulty === 'string' ? getDifficultyPreset(difficulty) : difficulty;
  let speed = (CONFIG.speed.base + CONFIG.speed.perEquipment[getTier(equipmentCount)]) * preset.speedMul;
  if (slowmo && CONFIG.effects.slowmoOverridesBoost) {
    speed *= CONFIG.speed.slowmoMultiplier;
  } else {
    if (boost) speed *= CONFIG.speed.boostMultiplier;
    if (slowmo) speed *= CONFIG.speed.slowmoMultiplier;
  }
  const cap = CONFIG.speed.maxScroll * preset.maxScrollMul;
  return Math.min(Math.max(0, speed), cap);
}

/** Multiplicateur de vitesse des projectiles / menaces hors scroll (ralenti) */
export function getThreatTimeScale(slowmo: boolean): number {
  return slowmo ? CONFIG.speed.slowmoMultiplier : 1;
}

export function isAttackUnlocked(
  family: AttackFamily,
  tier: number,
  elapsedSec: number,
): boolean {
  const rule = CONFIG.attackUnlock[family];
  return tier >= rule.minTier && elapsedSec >= rule.minTime;
}

/** Prochaine voie après une entrée latérale (sans tween). */
export function nextLaneIndex(
  current: number,
  dir: number,
  closedLane: number | null,
  laneCount = LANES,
): number {
  let next = PhaserClamp(current + dir, 0, laneCount - 1);
  if (closedLane !== null && next === closedLane) {
    const skip = next + dir;
    if (skip >= 0 && skip < laneCount) next = skip;
    else return current;
  }
  return next;
}

function PhaserClamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Parse ?debug=1 / ?seed=123 — outils dév uniquement */
export function readDevQuery(search = typeof location !== 'undefined' ? location.search : ''): {
  debug: boolean;
  seed: number | null;
} {
  const isDev = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;
  const params = new URLSearchParams(search);
  const seedRaw = params.get('seed');
  const seed = seedRaw != null && seedRaw !== '' ? Number(seedRaw) : null;
  return {
    debug: isDev && (params.get('debug') === '1' || params.get('debug') === 'true'),
    seed: seed != null && Number.isFinite(seed) ? seed : null,
  };
}
