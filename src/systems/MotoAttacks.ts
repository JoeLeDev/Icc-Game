import type Phaser from 'phaser';
import { MOTO_ATTACK_PROFILE, createEnemyAttackState, tickEnemyAttack, type EnemyAttackState } from '../config/enemyRamming';
import { DEPTH } from './RoadProjection';
import { applyWorldDisplayForKey } from './SpriteDisplay';

export interface MotoAttackTarget {
  hit: boolean;
  attackState?: EnemyAttackState;
}

/** Cooldown des motos et lancement visuel de leurs projectiles. */
export class MotoAttacks {
  constructor(private readonly scene: Phaser.Scene) {}

  tick(target: MotoAttackTarget, dt: number, enabled: boolean, fire: () => void): void {
    if (!enabled || target.hit) return;
    target.attackState ??= createEnemyAttackState(MOTO_ATTACK_PROFILE);
    const stepped = tickEnemyAttack(target.attackState, MOTO_ATTACK_PROFILE, dt);
    target.attackState = stepped.state;
    if (stepped.shouldFire) fire();
  }

  launch(
    source: Phaser.GameObjects.Image,
    target: { lane: number; x: number; y: number; laneHalf: number; durationScale: number; bottom: number },
    texture: string,
    onCreated: (projectile: Phaser.GameObjects.Image, lane: number) => void,
  ): void {
    const projectile = this.scene.add.image(source.x, source.y - 18, texture).setDepth(DEPTH.fx);
    applyWorldDisplayForKey(projectile, 'projectile');
    projectile.setData('armed', false);
    onCreated(projectile, target.lane);
    this.scene.tweens.add({
      targets: projectile, x: target.x, y: target.y, duration: 900 / target.durationScale,
      onUpdate: () => projectile.active && projectile.setData('armed', Math.abs(projectile.x - target.x) <= target.laneHalf),
      onComplete: () => {
        if (!projectile.active) return;
        projectile.setData('armed', true);
        this.scene.tweens.add({ targets: projectile, y: target.bottom, duration: 400 / target.durationScale });
      },
    });
  }
}
