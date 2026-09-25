import { CONFIG } from '../config/gameConfig';
import type { FinalGrade } from '../config/scoring';
import {
  DEFAULT_DIFFICULTY,
  type DifficultyId,
  getDifficultyPreset,
  isDifficultyId,
} from '../config/difficulty';

export interface LocalScore {
  distance: number;
  equipment: number;
  love: boolean;
  date: string;
  score?: number;
  grade?: FinalGrade;
}

const memory = new Map<string, string>();

function get(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
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

function isLocalScore(value: unknown): value is LocalScore {
  if (!value || typeof value !== 'object') return false;
  const score = value as Partial<LocalScore>;
  return (
    Number.isFinite(score.distance) &&
    Number.isFinite(score.equipment) &&
    typeof score.love === 'boolean' &&
    typeof score.date === 'string' &&
    (score.score === undefined || Number.isFinite(score.score))
  );
}

export const Storage = {
  getSoundEnabled(): boolean {
    const v = get(CONFIG.storage.soundKey);
    return v === null ? true : v === '1';
  },

  setSoundEnabled(on: boolean): void {
    set(CONFIG.storage.soundKey, on ? '1' : '0');
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

  getLeaderboard(): LocalScore[] {
    try {
      const parsed: unknown = JSON.parse(get(CONFIG.storage.leaderboardKey) || '[]');
      return Array.isArray(parsed) ? parsed.filter(isLocalScore) : [];
    } catch {
      return [];
    }
  },

  addScore(entry: LocalScore): void {
    const board = this.getLeaderboard();
    board.push(entry);
    board.sort(
      (a, b) =>
        (b.score ?? b.distance) - (a.score ?? a.distance) ||
        b.distance - a.distance ||
        b.equipment - a.equipment,
    );
    set(CONFIG.storage.leaderboardKey, JSON.stringify(board.slice(0, 10)));
    this.setBestDistance(entry.distance);
  },
};
