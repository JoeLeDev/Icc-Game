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

export const Storage = {
  getSoundEnabled(): boolean {
    const v = localStorage.getItem(CONFIG.storage.soundKey);
    return v === null ? true : v === '1';
  },

  setSoundEnabled(on: boolean): void {
    localStorage.setItem(CONFIG.storage.soundKey, on ? '1' : '0');
  },

  getDifficulty(): DifficultyId {
    const v = localStorage.getItem(CONFIG.storage.difficultyKey);
    return isDifficultyId(v) ? v : DEFAULT_DIFFICULTY;
  },

  setDifficulty(id: DifficultyId): void {
    localStorage.setItem(CONFIG.storage.difficultyKey, getDifficultyPreset(id).id);
  },

  getBestDistance(): number {
    return Number(localStorage.getItem(CONFIG.storage.bestScoreKey) || 0);
  },

  setBestDistance(m: number): void {
    const best = this.getBestDistance();
    if (m > best) localStorage.setItem(CONFIG.storage.bestScoreKey, String(Math.floor(m)));
  },

  getLeaderboard(): LocalScore[] {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.storage.leaderboardKey) || '[]');
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
    localStorage.setItem(CONFIG.storage.leaderboardKey, JSON.stringify(board.slice(0, 10)));
    this.setBestDistance(entry.distance);
  },
};
