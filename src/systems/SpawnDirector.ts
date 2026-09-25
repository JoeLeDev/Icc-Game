import { CONFIG } from '../config/gameConfig';
import type { DifficultyPreset } from '../config/difficulty';
import type { Rng } from '../utils/Rng';

export interface SpawnDirectorCallbacks {
  isFinalSpawnBlocked(): boolean;
  equipmentCount(): number;
  spawnObstaclePattern(tier: number): void;
  spawnEquipment(): void;
  spawnBonusOrLove(): void;
  spawnAttack(tier: number): boolean;
}

/** Cadence des apparitions ; la scène reste propriétaire de la création d’entités. */
export class SpawnDirector {
  private timers = { obstacle: 3.5, equipment: CONFIG.spawn.firstEquipmentDelay, bonus: 16, attack: 22 };
  private breathRemaining = 0;

  constructor(
    private readonly callbacks: SpawnDirectorCallbacks,
    private readonly rng: Rng,
  ) {}

  reset(difficulty: DifficultyPreset): void {
    this.timers = {
      obstacle: 3.5 * difficulty.obstacleIntervalMul,
      equipment: CONFIG.spawn.firstEquipmentDelay,
      bonus: 16,
      attack: 22 * difficulty.attackIntervalMul,
    };
    this.breathRemaining = 0;
  }

  tick(dt: number, difficulty: DifficultyPreset): void {
    if (this.callbacks.isFinalSpawnBlocked()) return;
    this.breathRemaining = Math.max(0, this.breathRemaining - dt);
    const tier = Math.min(7, this.callbacks.equipmentCount());
    const breathSlow = this.breathRemaining > 0 ? 0.45 : 1;
    this.timers.obstacle -= dt * breathSlow;
    this.timers.equipment -= dt;
    this.timers.bonus -= dt;
    this.timers.attack -= dt * breathSlow;

    if (this.timers.obstacle <= 0) {
      this.callbacks.spawnObstaclePattern(tier);
      this.timers.obstacle = CONFIG.spawn.obstacleInterval[tier]! * difficulty.obstacleIntervalMul * this.rng.float(0.9, 1.12);
    }
    if (this.timers.equipment <= 0 && this.callbacks.equipmentCount() < 7) {
      this.callbacks.spawnEquipment();
      this.timers.equipment = CONFIG.spawn.equipmentInterval[tier]! * this.rng.float(0.92, 1.12);
    }
    if (this.timers.bonus <= 0) {
      this.callbacks.spawnBonusOrLove();
      this.timers.bonus = CONFIG.spawn.bonusInterval[tier]! * this.rng.float(0.9, 1.2);
    }
    if (this.timers.attack <= 0 && CONFIG.spawn.attackInterval[tier]! < 90) {
      if (this.callbacks.spawnAttack(tier)) this.applyBreath();
      this.timers.attack = CONFIG.spawn.attackInterval[tier]! * difficulty.attackIntervalMul * this.rng.float(0.9, 1.15);
    }
  }

  applyBreath(delayAttack = false): void {
    this.breathRemaining = Math.max(this.breathRemaining, CONFIG.spawn.breathAfterAttack);
    if (delayAttack) this.timers.attack = Math.max(this.timers.attack, CONFIG.spawn.attackDelayAfterDouble);
  }
}
