import { describe, expect, it } from 'vitest';
import { SpawnDirector, type SpawnDirectorCallbacks } from './SpawnDirector';
import type { DifficultyPreset } from '../config/difficulty';
import type { Rng } from '../utils/Rng';

const difficulty: DifficultyPreset = {
  id: 'normal', label: 'Normal', speedMul: 1, obstacleIntervalMul: 1, attackIntervalMul: 1,
  doubleBlockMul: 1, maxScrollMul: 1,
};

function createHarness(equipment = 0): {
  director: SpawnDirector;
  calls: string[];
  setEquipment(value: number): void;
} {
  const calls: string[] = [];
  let count = equipment;
  const callbacks: SpawnDirectorCallbacks = {
    isFinalSpawnBlocked: () => false,
    equipmentCount: () => count,
    spawnObstaclePattern: () => calls.push('obstacle'),
    spawnEquipment: () => calls.push('equipment'),
    spawnBonusOrLove: () => calls.push('bonus'),
    spawnAttack: () => { calls.push('attack'); return true; },
  };
  const rng = { float: () => 1 } as Rng;
  const director = new SpawnDirector(callbacks, rng);
  director.reset(difficulty);
  return { director, calls, setEquipment: (value) => { count = value; } };
}

describe('SpawnDirector', () => {
  it('déclenche les familles de spawn selon leurs timers', () => {
    const { director, calls } = createHarness(1);
    director.tick(30, difficulty);
    expect(calls).toEqual(expect.arrayContaining(['obstacle', 'equipment', 'bonus', 'attack']));
  });

  it('ne crée plus d’équipement une fois les sept récupérés', () => {
    const { director, calls } = createHarness(7);
    director.tick(30, difficulty);
    expect(calls).not.toContain('equipment');
  });

  it('ralentit les spawns après une respiration', () => {
    const baseline = createHarness(1);
    baseline.director.tick(3.6, difficulty);
    expect(baseline.calls).toContain('obstacle');

    const delayed = createHarness(1);
    delayed.director.applyBreath();
    delayed.director.tick(1, difficulty);
    delayed.director.tick(2.6, difficulty);
    expect(delayed.calls).not.toContain('obstacle');
  });
});
