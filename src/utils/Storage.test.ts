import { beforeEach, expect, it, vi } from 'vitest';
import { CONFIG } from '../config/gameConfig';

beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });
it('preserves legacy scores and keeps separate top tens for each difficulty', async () => {
  const data = new Map([[CONFIG.storage.leaderboardKey, JSON.stringify([{ distance: 50, equipment: 1, love: false, date: 'old' }])]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  const { Storage } = await import('./Storage');
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    for (let i = 0; i < 12; i++) Storage.addScore({ distance: i, score: i, equipment: 0, love: false, date: 'now', difficulty });
    expect(Storage.getLeaderboard(difficulty)).toHaveLength(10);
  }
  expect(Storage.getLeaderboard('legacy')).toHaveLength(1);
});
it('keeps preferences in memory when persistent writes fail', async () => {
  vi.stubGlobal('localStorage', { getItem: () => '0', setItem: () => { throw new Error('quota'); } });
  const { Storage } = await import('./Storage');
  Storage.setReducedMotion(true);
  expect(Storage.getReducedMotion()).toBe(true);
});
