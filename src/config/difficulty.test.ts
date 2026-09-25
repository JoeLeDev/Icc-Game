import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY_PRESETS,
  DEFAULT_DIFFICULTY,
  getDifficultyPreset,
  isDifficultyId,
} from './difficulty';
import { CONFIG, getScrollSpeed } from './gameConfig';

describe('difficulty presets', () => {
  it('facile < normal < difficile en vitesse', () => {
    const e = getDifficultyPreset('easy');
    const n = getDifficultyPreset('normal');
    const h = getDifficultyPreset('hard');
    expect(e.speedMul).toBeLessThan(n.speedMul);
    expect(n.speedMul).toBeLessThan(h.speedMul);
  });

  it('fréquence d’apparition proportionnelle à la vitesse', () => {
    for (const p of Object.values(DIFFICULTY_PRESETS)) {
      expect(p.speedMul * p.obstacleIntervalMul).toBeCloseTo(1, 5);
      expect(p.speedMul * p.attackIntervalMul).toBeCloseTo(1, 5);
    }
  });

  it('getScrollSpeed respecte la difficulté', () => {
    const easy = getScrollSpeed(3, false, false, 'easy');
    const normal = getScrollSpeed(3, false, false, 'normal');
    const hard = getScrollSpeed(3, false, false, 'hard');
    expect(normal / easy).toBeCloseTo(
      DIFFICULTY_PRESETS.normal.speedMul / DIFFICULTY_PRESETS.easy.speedMul,
      5,
    );
    expect(hard / easy).toBeCloseTo(
      DIFFICULTY_PRESETS.hard.speedMul / DIFFICULTY_PRESETS.easy.speedMul,
      5,
    );
    expect(hard).toBeLessThanOrEqual(
      CONFIG.speed.maxScroll * DIFFICULTY_PRESETS.hard.maxScrollMul + 1e-6,
    );
  });

  it('défaut = normal', () => {
    expect(DEFAULT_DIFFICULTY).toBe('normal');
    expect(isDifficultyId('easy')).toBe(true);
    expect(isDifficultyId('nightmare')).toBe(false);
  });
});
