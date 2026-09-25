/**
 * Score de run + note finale.
 * Les doutes (?) rapportent des points et comptent dans la note.
 */

export const SCORE = {
  /** Points par mètre parcouru */
  perMeter: 1,
  /** Dissiper un doute (?) */
  perDoubt: 75,
  /** Obstacle / menace évité(e) */
  perAvoided: 12,
  /** Chaque équipement unique */
  perEquipment: 120,
  /** Collecte de l’Amour */
  loveBonus: 250,
  /** Victoire (conquête finale) */
  winBonus: 400,
} as const;

export type FinalGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E';

export interface RunScoreInput {
  distance: number;
  doubts: number;
  avoided: number;
  equipment: number;
  love: boolean;
  won: boolean;
}

export interface RunScoreResult {
  total: number;
  grade: FinalGrade;
  gradeLabel: string;
  breakdown: {
    distance: number;
    doubts: number;
    avoided: number;
    equipment: number;
    love: number;
    win: number;
  };
}

const GRADE_THRESHOLDS: { min: number; grade: FinalGrade; label: string }[] = [
  { min: 2200, grade: 'S', label: 'Conquérante' },
  { min: 1600, grade: 'A', label: 'Équipée' },
  { min: 1100, grade: 'B', label: 'Vaillante' },
  { min: 700, grade: 'C', label: 'En route' },
  { min: 350, grade: 'D', label: 'Apprentie' },
  { min: 0, grade: 'E', label: 'À relever' },
];

export function computeRunScore(input: RunScoreInput): RunScoreResult {
  const dist = Math.max(0, Math.floor(input.distance));
  const doubts = Math.max(0, Math.floor(input.doubts));
  const avoided = Math.max(0, Math.floor(input.avoided));
  const equipment = Math.max(0, Math.min(7, Math.floor(input.equipment)));

  const breakdown = {
    distance: dist * SCORE.perMeter,
    doubts: doubts * SCORE.perDoubt,
    avoided: avoided * SCORE.perAvoided,
    equipment: equipment * SCORE.perEquipment,
    love: input.love ? SCORE.loveBonus : 0,
    win: input.won ? SCORE.winBonus : 0,
  };

  const total =
    breakdown.distance +
    breakdown.doubts +
    breakdown.avoided +
    breakdown.equipment +
    breakdown.love +
    breakdown.win;

  const row = GRADE_THRESHOLDS.find((g) => total >= g.min) ?? GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1]!;
  return {
    total,
    grade: row.grade,
    gradeLabel: row.label,
    breakdown,
  };
}

export function gradeForScore(total: number): { grade: FinalGrade; label: string } {
  const row = GRADE_THRESHOLDS.find((g) => total >= g.min) ?? GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1]!;
  return { grade: row.grade, label: row.label };
}
