import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { EntityManager } from './EntityManager';
import { EntityRuntime, type EntityRuntimeHost } from './EntityRuntime';
import type { LaneEntity } from './EntityTypes';
import { hitRectForRole } from './Hitbox';

vi.mock('./AssetFactory', () => ({ textureKey: (key: string) => key }));
vi.mock('../utils/AudioManager', () => ({ audio: { ui: vi.fn(), hit: vi.fn() } }));

function harness() {
  const disposed = vi.fn();
  const manager = new EntityManager<LaneEntity>(disposed);
  const host = {
    scrollSpeed: 100, player: { x: 100, y: 100 }, BW: 390, BH: 844,
    obstaclesAvoided: 0, doubtsCleared: 0, runScore: 0, lives: 3,
    invincibleRemaining: 0, hasTempShield: false, lane: 1, playing: true, paused: false,
    world: { proj: { maxZ: 420 } },
    getPlayerHitRect: () => hitRectForRole(100, 100, 50, 80, 'player'),
    getEntityHitRect: () => hitRectForRole(110, 100, 50, 80, 'player'),
    layoutEntity: vi.fn(), hasEffect: vi.fn(() => false), drawHitboxDebug: vi.fn(),
    collectEquipment: vi.fn(), collectBonus: vi.fn(), collectLove: vi.fn(), refreshHudScore: vi.fn(),
    feedback: { toast: vi.fn(), burst: vi.fn(), vibrate: vi.fn(), flashScreen: vi.fn() },
    cameras: { main: { shake: vi.fn() } }, refreshHearts: vi.fn(), snapToPreviousLane: vi.fn(), endGame: vi.fn(),
    motoAttacks: { tick: vi.fn() },
  };
  const runtime = new EntityRuntime(manager, host as unknown as EntityRuntimeHost, {} as Phaser.Scene);
  function entity(overrides: Partial<LaneEntity> = {}) {
    const sprite = {
      x: 900, y: 0, scaleX: 1, active: true, setTint: vi.fn(), setDepth: vi.fn(),
      getBounds: () => ({ left: 900, right: 950, top: 0, bottom: 50 }),
    } as unknown as Phaser.GameObjects.Image;
    return manager.add({ sprite, lane: 1, worldZ: 300, kind: 'obstacle', hit: true, ...overrides });
  }
  return { manager, host, runtime, entity, disposed };
}

describe('entity lifecycle and resolution', () => {
  it('removes every expired entity during reverse traversal', () => {
    const h = harness();
    h.entity({ kind: 'firezone', life: 0.01 });
    h.entity({ kind: 'firezone', life: 0.01 });
    h.runtime.tick(0.1);
    expect(h.manager.count).toBe(0);
    expect(h.disposed).toHaveBeenCalledTimes(2);
  });
  it('turns a completed fire fuse into a temporary fire zone', () => {
    const h = harness();
    const e = h.entity({ kind: 'colere', fuse: 0.05 });
    h.runtime.tick(0.1);
    expect(e.kind).toBe('firezone');
    expect(e.fuse).toBeUndefined();
    expect(e.life).toBeCloseTo(2.1);
  });
  it('despawns offscreen obstacles and credits one avoidance', () => {
    const h = harness();
    h.entity({ worldZ: -170 });
    h.runtime.tick(0.1);
    expect(h.manager.count).toBe(0);
    expect(h.host.obstaclesAvoided).toBe(1);
  });
  it('resolves a pickup once even if a stale contact is delivered twice', () => {
    const h = harness();
    const e = h.entity({ kind: 'equipment', equipmentId: 'belt', hit: false });
    h.runtime.resolve(e, 0);
    h.runtime.resolve(e, 0);
    expect(h.host.collectEquipment).toHaveBeenCalledTimes(1);
    expect(h.manager.count).toBe(0);
  });
  it('consumes a shield before health and respects damage immunity', () => {
    const h = harness();
    h.host.hasTempShield = true;
    h.runtime.takeHit(0, 0);
    expect(h.host.hasTempShield).toBe(false);
    expect(h.host.lives).toBe(3);
    h.runtime.takeHit(0, 0);
    expect(h.host.lives).toBe(3);
    h.host.invincibleRemaining = 0;
    h.host.lives = 1;
    h.runtime.takeHit(0, 0);
    expect(h.host.endGame).toHaveBeenCalledWith(false);
  });
  it('clear disposes once and accepts a new run', () => {
    const h = harness();
    h.entity(); h.entity();
    h.manager.clear(); h.manager.clear();
    expect(h.disposed).toHaveBeenCalledTimes(2);
    h.entity();
    expect(h.manager.count).toBe(1);
  });
  it('a winning side hit removes the motorcycle without costing a life', () => {
    const h = harness();
    h.host.getEntityHitRect = () => hitRectForRole(130, 100, 50, 80, 'player');
    const e = h.entity({ kind: 'depression', hit: false, sideHits: 1 });
    h.runtime.resolve(e, 0);
    expect(e.sideHits).toBe(2);
    expect(h.manager.count).toBe(0);
    expect(h.host.lives).toBe(3);
    expect(h.host.obstaclesAvoided).toBe(1);
  });
  it.each(['depression', 'peur'] as const)('a rear collision with %s only damages the player', (kind) => {
    const h = harness();
    h.host.getEntityHitRect = () => hitRectForRole(100, 100, 50, 80, 'player');
    const attackState = { phase: 'windup' as const, timer: 0.2, lastHitSerial: 1 };
    const e = h.entity({ kind, hit: false, sideHits: 1, attackHitSerial: 1, attackState });

    h.runtime.resolve(e, 0);

    expect(h.host.lives).toBe(2);
    expect(h.host.snapToPreviousLane).toHaveBeenCalledWith(e.lane);
    expect(h.manager.items).toEqual([e]);
    expect(h.disposed).not.toHaveBeenCalled();
    expect(e.hit).toBe(false);
    expect(e.sideHits).toBe(1);
    expect(e.attackState).toEqual({ phase: 'windup', timer: 0.2, lastHitSerial: 1 });
    expect(e.attackHitSerial).toBe(1);
    expect(h.host.obstaclesAvoided).toBe(0);

    // The same ongoing contact cannot consume another life during player immunity.
    h.runtime.resolve(e, 0);
    expect(h.host.lives).toBe(2);
    expect(h.host.snapToPreviousLane).toHaveBeenCalledTimes(1);

    // A later rear contact still damages the player; the enemy remains alive.
    h.host.invincibleRemaining = 0;
    h.runtime.resolve(e, 0);
    expect(h.host.lives).toBe(1);
    expect(h.manager.count).toBe(1);

    // The retained enemy can still be defeated by the second offensive side hit.
    h.host.getEntityHitRect = () => hitRectForRole(130, 100, 50, 80, 'player');
    h.runtime.resolve(e, 0);
    expect(e.sideHits).toBe(2);
    expect(h.manager.count).toBe(0);
    expect(h.host.lives).toBe(1);
  });
  it('a shielded rear collision preserves the enemy and only consumes the shield', () => {
    const h = harness();
    h.host.getEntityHitRect = () => hitRectForRole(100, 100, 50, 80, 'player');
    h.host.hasTempShield = true;
    const e = h.entity({ kind: 'depression', hit: false, sideHits: 0 });
    h.runtime.resolve(e, 0);
    expect(h.host.hasTempShield).toBe(false);
    expect(h.host.lives).toBe(3);
    expect(h.manager.items).toEqual([e]);
    expect(e.hit).toBe(false);
    expect(e.sideHits).toBe(0);
  });
  it('checks subsequent contacts at the new position after a rebound', () => {
    const h = harness();
    h.host.getPlayerHitRect = () => hitRectForRole(h.host.player.x, 100, 50, 80, 'player');
    for (let i = 0; i < 2; i++) {
      const e = h.entity({ kind: 'obstacle', hit: false, worldZ: 10 });
      Object.assign(e.sprite, { x: 100, y: 100, displayWidth: 50, displayHeight: 80,
        texture: { key: 'car' }, getData: () => undefined, setData: vi.fn() });
    }
    const resolve = vi.spyOn(h.runtime, 'resolve').mockImplementation(() => { h.host.player.x = 300; });
    h.runtime.tick(0.01);
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
