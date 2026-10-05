import { CONFIG } from '../config/gameConfig';
import type { FinalGrade } from '../config/scoring';
import {
  DEFAULT_DIFFICULTY,
  type DifficultyId,
  getDifficultyPreset,
  isDifficultyId,
} from '../config/difficulty';

export interface LocalScore {
  /** Pseudo du joueur (classement local) */
  name: string;
  distance: number;
  equipment: number;
  love: boolean;
  date: string;
  score?: number;
  grade?: FinalGrade;
  difficulty?: DifficultyId;
}

export const DEFAULT_PLAYER_NAME = 'Joueuse';
export const PLAYER_NAME_MAX_LEN = 16;

const memory = new Map<string, string>();

function get(key: string): string | null {
  try {
    return memory.get(key) ?? localStorage.getItem(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function set(key: string, value: string): void {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // Le jeu reste utilisable lorsque le stockage est désactivé ou plein.
  }
}

/** Nettoie et borne un pseudo (espaces, longueur). */
export function normalizePlayerName(raw: string | null | undefined): string {
  const cleaned = (raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PLAYER_NAME_MAX_LEN);
  return cleaned || DEFAULT_PLAYER_NAME;
}

function isLocalScore(value: unknown): value is LocalScore {
  if (!value || typeof value !== 'object') return false;
  const score = value as Partial<LocalScore>;
  return (
    Number.isFinite(score.distance) &&
    Number.isFinite(score.equipment) &&
    typeof score.love === 'boolean' &&
    typeof score.date === 'string' &&
    (score.score === undefined || Number.isFinite(score.score)) &&
    (score.name === undefined || typeof score.name === 'string')
  );
}

/** Garantit un `name` même pour les anciennes entrées sans pseudo. */
function withPlayerName(entry: LocalScore): LocalScore {
  return {
    ...entry,
    name: normalizePlayerName(entry.name),
  };
}

export const Storage = {
  getReducedMotion(): boolean {
    const stored = get('khayil-reduced-motion');
    return stored === null
      ? typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      : stored === '1';
  },

  setReducedMotion(reduced: boolean): void {
    set('khayil-reduced-motion', reduced ? '1' : '0');
  },

  getSoundEnabled(): boolean {
    const v = get(CONFIG.storage.soundKey);
    return v === null ? true : v === '1';
  },

  setSoundEnabled(on: boolean): void {
    set(CONFIG.storage.soundKey, on ? '1' : '0');
  },

  getPlayerName(): string {
    return normalizePlayerName(get(CONFIG.storage.playerNameKey));
  },

  setPlayerName(name: string): string {
    const normalized = normalizePlayerName(name);
    set(CONFIG.storage.playerNameKey, normalized);
    return normalized;
  },

  getDifficulty(): DifficultyId {
    const v = get(CONFIG.storage.difficultyKey);
    return isDifficultyId(v) ? v : DEFAULT_DIFFICULTY;
  },

  setDifficulty(id: DifficultyId): void {
    set(CONFIG.storage.difficultyKey, getDifficultyPreset(id).id);
  },

  getBestDistance(): number {
    const value = Number(get(CONFIG.storage.bestScoreKey) || 0);
    return Number.isFinite(value) ? value : 0;
  },

  setBestDistance(m: number): void {
    const best = this.getBestDistance();
    if (m > best) set(CONFIG.storage.bestScoreKey, String(Math.floor(m)));
  },

  getLeaderboard(difficulty?: DifficultyId | 'legacy'): LocalScore[] {
    try {
      const parsed: unknown = JSON.parse(get(CONFIG.storage.leaderboardKey) || '[]');
      const scores = Array.isArray(parsed) ? parsed.filter(isLocalScore).map(withPlayerName) : [];
      return scores.filter((entry) =>
        !difficulty ||
        (difficulty === 'legacy' ? !isDifficultyId(entry.difficulty) : entry.difficulty === difficulty),
      );
    } catch {
      return [];
    }
  },

  addScore(entry: LocalScore): void {
    const board = this.getLeaderboard();
    board.push(
      withPlayerName({
        ...entry,
        name: entry.name ?? this.getPlayerName(),
      }),
    );
    board.sort(
      (a, b) =>
        (b.score ?? b.distance) - (a.score ?? a.distance) ||
        b.distance - a.distance ||
        b.equipment - a.equipment,
    );
    const counts = new Map<string, number>();
    const retained = board.filter((score) => {
      const key = isDifficultyId(score.difficulty) ? score.difficulty : 'legacy';
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return count <= 10;
    });
    set(CONFIG.storage.leaderboardKey, JSON.stringify(retained));
    this.setBestDistance(entry.distance);
  },
};
