import type Phaser from 'phaser';
import { aabbOverlap, aabbSweptOverlap, hitRectForRole, hitRoleForKey, type HitRect } from './Hitbox';

export interface CollisionEntity {
  kind: string;
  lane: number;
  worldZ: number;
  screenSpace?: boolean;
  logicalKey?: string;
}

export function entityHitRect(entity: CollisionEntity, sprite: Phaser.GameObjects.Image): HitRect {
  return hitRectForRole(
    sprite.x, sprite.y, sprite.displayWidth, sprite.displayHeight,
    hitRoleForKey(entity.logicalKey ?? sprite.texture.key),
  );
}

/** Détection de contact écran, avec mémoire de frame pour éviter le tunneling. */
export function intersectsPlayer(
  entity: CollisionEntity,
  sprite: Phaser.GameObjects.Image,
  player: HitRect,
  options: { playerLane: number; laneTweenPlaying: boolean; maxZ: number; rammable(kind: string): boolean },
): boolean {
  const target = entityHitRect(entity, sprite);
  if (entity.screenSpace && entity.kind === 'projectile') {
    if (Math.round(entity.lane) !== options.playerLane || sprite.getData('armed') === false) {
      remember(sprite);
      return false;
    }
  }
  if (!entity.screenSpace) {
    const laneOk = Math.round(entity.lane) === options.playerLane ||
      (options.rammable(entity.kind) && Math.abs(Math.round(entity.lane) - options.playerLane) <= 1) ||
      (options.laneTweenPlaying && Math.abs(Math.round(entity.lane) - options.playerLane) <= 1);
    if (!laneOk || entity.worldZ > options.maxZ * 0.55) {
      remember(sprite);
      return false;
    }
  }
  const previousX = sprite.getData('prevHitX') as number | undefined;
  const previousY = sprite.getData('prevHitY') as number | undefined;
  const hit = previousX != null && previousY != null
    ? aabbSweptOverlap(player, hitRectForRole(previousX, previousY, sprite.displayWidth, sprite.displayHeight, entity.screenSpace ? 'projectile' : hitRoleForKey(entity.logicalKey ?? sprite.texture.key)), target)
    : aabbOverlap(player, target);
  remember(sprite);
  return hit;
}

function remember(sprite: Phaser.GameObjects.Image): void {
  sprite.setData('prevHitX', sprite.x);
  sprite.setData('prevHitY', sprite.y);
}
