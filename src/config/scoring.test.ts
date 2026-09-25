import { describe, expect, it } from 'vitest';
import { SCORE, computeRunScore, gradeForScore } from './scoring';

describe('scoring — doutes et note finale', () => {
  it('attribue des points par doute dissipé', () => {
    const zero = computeRunScore({
      distance: 0,
      doubts: 0,
      avoided: 0,
      equipment: 0,
      love: false,
      won: false,
    });
    const one = computeRunScore({
      distance: 0,
      doubts: 1,
      avoided: 0,
      equipment: 0,
      love: false,
      won: false,
    });
    expect(one.total - zero.total).toBe(SCORE.perDoubt);
    expect(one.breakdown.doubts).toBe(SCORE.perDoubt);
  });

  it('calcule une note plus haute avec plus de doutes / distance', () => {
    const low = computeRunScore({
      distance: 50,
      doubts: 0,
      avoided: 0,
      equipment: 0,
      love: false,
      won: false,
    });
    const high = computeRunScore({
      distance: 800,
      doubts: 8,
      avoided: 20,
      equipment: 7,
      love: true,
      won: true,
    });
    expect(high.total).toBeGreaterThan(low.total);
    expect(['S', 'A', 'B']).toContain(high.grade);
    expect(high.gradeLabel.length).toBeGreaterThan(0);
  });

  it('gradeForScore respecte les seuils', () => {
    expect(gradeForScore(0).grade).toBe('E');
    expect(gradeForScore(2500).grade).toBe('S');
  });
});
