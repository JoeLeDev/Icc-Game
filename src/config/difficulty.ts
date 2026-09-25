/** Niveaux de difficulté joueur — multiplient la config de progression existante. */

export const DIFFICULTY_IDS = ['easy', 'normal', 'hard'] as const;
export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

export type DifficultyPreset = {
  id: DifficultyId;
  label: string;
  /** Multiplie la vitesse de défilement (voitures / monde) */
  speedMul: number;
  /** Multiplie les intervalles d’obstacles (>1 = plus rares, 1/speedMul = fréquence ∝ vitesse) */
  obstacleIntervalMul: number;
  /** Multiplie les intervalles d’attaques ennemies */
  attackIntervalMul: number;
  /** Multiplie la chance de double blocage */
  doubleBlockMul: number;
  /** Plafond de scroll relatif à CONFIG.speed.maxScroll */
  maxScrollMul: number;
};

/**
 * Facile = rythme actuel (baseline).
 * Normal = +30 % vitesse + fréquence proportionnelle.
 * Difficile = +50 % vitesse + fréquence proportionnelle.
 */
function presetFromSpeed(
  id: DifficultyId,
  label: string,
  speedMul: number,
): DifficultyPreset {
  const intervalMul = 1 / speedMul;
  return {
    id,
    label,
    speedMul,
    obstacleIntervalMul: intervalMul,
    attackIntervalMul: intervalMul,
    doubleBlockMul: speedMul,
    maxScrollMul: speedMul,
  };
}

export const DIFFICULTY_PRESETS: Record<DifficultyId, DifficultyPreset> = {
  easy: presetFromSpeed('easy', 'Facile', 1.5),
  normal: presetFromSpeed('normal', 'Normal', 2.0),
  hard: presetFromSpeed('hard', 'Difficile', 2.5),
};

export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

export function isDifficultyId(v: string | null | undefined): v is DifficultyId {
  return !!v && (DIFFICULTY_IDS as readonly string[]).includes(v);
}

export function getDifficultyPreset(id: DifficultyId = DEFAULT_DIFFICULTY): DifficultyPreset {
  return DIFFICULTY_PRESETS[id] ?? DIFFICULTY_PRESETS.normal;
}
