import { CONFIG } from '../config/gameConfig';

export interface LocalScore {
  distance: number;
  equipment: number;
  love: boolean;
  date: string;
}

export const Storage = {
  getSoundEnabled(): boolean {
    const v = localStorage.getItem(CONFIG.storage.soundKey);
    return v === null ? true : v === '1';
  },

  setSoundEnabled(on: boolean): void {
    localStorage.setItem(CONFIG.storage.soundKey, on ? '1' : '0');
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
    board.sort((a, b) => b.distance - a.distance || b.equipment - a.equipment);
    localStorage.setItem(CONFIG.storage.leaderboardKey, JSON.stringify(board.slice(0, 10)));
    this.setBestDistance(entry.distance);
  },
};
