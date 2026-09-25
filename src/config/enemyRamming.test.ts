import { describe, expect, it } from 'vitest';
import {
  ENEMY_SIDE_RATIO,
  MOTO_SHOOT_INTERVAL,
  MOTO_SIDE_HITS_TO_DEFEAT,
  MAX_MOTO_FOES,
  classifyEnemyRam,
  enemyZoneRects,
  isRammableEnemyKind,
  sideHitDefeats,
} from './enemyRamming';
import { makeHitRect } from '../systems/Hitbox';

function box(x: number, y: number, w: number, h: number) {
  return makeHitRect(x, y, w, h, 0, 0);
}

describe('enemyRamming', () => {
  it('reconnaît les ennemis percutables', () => {
    expect(isRammableEnemyKind('depression')).toBe(true);
    expect(isRammableEnemyKind('peur')).toBe(true);
    expect(isRammableEnemyKind('obstacle')).toBe(false);
    expect(isRammableEnemyKind('car')).toBe(false);
  });

  it('collision centrée depuis l’arrière = rear (joueur perd)', () => {
    const enemy = box(200, 400, 80, 100);
    const player = box(200, 455, 60, 90);
    expect(classifyEnemyRam(player, enemy)).toBe('rear');
  });

  it('collision flanc gauche = side_left', () => {
    const enemy = box(200, 400, 80, 100);
    const player = box(155, 420, 60, 90);
    expect(classifyEnemyRam(player, enemy)).toBe('side_left');
  });

  it('collision flanc droit = side_right', () => {
    const enemy = box(200, 400, 80, 100);
    const player = box(245, 420, 60, 90);
    expect(classifyEnemyRam(player, enemy)).toBe('side_right');
  });

  it('2 coups latéraux pour vaincre, max 2 foes', () => {
    expect(sideHitDefeats(1)).toBe(false);
    expect(sideHitDefeats(MOTO_SIDE_HITS_TO_DEFEAT)).toBe(true);
    expect(MAX_MOTO_FOES).toBe(2);
    expect(MOTO_SHOOT_INTERVAL).toBe(2);
  });

  it('zones rear/left/right plus petites que le corps', () => {
    const enemy = box(200, 400, 100, 120);
    const z = enemyZoneRects(enemy);
    expect(z.rear.w).toBeLessThan(enemy.w);
    expect(z.left.w).toBeLessThan(enemy.w * 0.4);
    expect(z.right.w).toBeLessThan(enemy.w * 0.4);
    expect(ENEMY_SIDE_RATIO).toBeGreaterThan(0.3);
  });
});
