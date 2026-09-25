import { describe, expect, it } from 'vitest';
import {
  MAX_SPAWNS_WITHOUT_MIDDLE,
  ObstacleLaneDistributor,
  PLAYER_LANE_TARGET_CHANCE,
  chooseObstacleLanesControlled,
  isLaneSafeAtDepth,
  preferredDoublePairs,
  simulateObstacleSpawns,
} from './obstacleSpawn';
import { choosePickupLane } from './obstacleSpawn';
import { Rng } from '../utils/Rng';
import type { RoadOccupant } from '../systems/SpawnFairness';

describe('obstacleSpawn — distribution contrôlée', () => {
  it('isLaneSafeAtDepth autorise la même lane si Δz ≥ gap', () => {
    const existing: RoadOccupant[] = [{ lane: 1, z: 100, role: 'danger' }];
    expect(
      isLaneSafeAtDepth(1, 320, existing, { minGap: 200, closedLane: null }).ok,
    ).toBe(true);
    expect(
      isLaneSafeAtDepth(1, 150, existing, { minGap: 200, closedLane: null }).ok,
    ).toBe(false);
  });

  it('anti-streak : le centre apparaît au plus tard tous les 4 spawns (si possible)', () => {
    const dist = new ObstacleLaneDistributor();
    const rng = new Rng(42);
    let without = 0;
    let maxWithout = 0;
    for (let i = 0; i < 80; i++) {
      const d = chooseObstacleLanesControlled({
        tier: 4,
        playerLane: 0, // joueur à gauche — centre peut être “oublié” sans anti-streak
        closedLane: null,
        existing: [],
        spawnZ: 380,
        scrollSpeed: 220,
        rng,
        distributor: dist,
      });
      expect(d).not.toBeNull();
      if (d!.lanes.includes(1)) without = 0;
      else {
        without++;
        maxWithout = Math.max(maxWithout, without);
      }
    }
    expect(maxWithout).toBeLessThanOrEqual(MAX_SPAWNS_WITHOUT_MIDDLE);
  });

  it('cible régulièrement la lane joueur (gauche / centre / droite)', () => {
    for (const playerLane of [0, 1, 2]) {
      const sim = simulateObstacleSpawns({
        count: 400,
        seed: 100 + playerLane,
        playerLane,
        tier: 3,
      });
      const hitRate = sim.playerLaneHits / Math.max(1, sim.singles + sim.counters.doubles);
      // Au moins ~28 % des événements touchent la lane joueur (cible 45 % singles + doubles)
      expect(hitRate).toBeGreaterThan(0.28);
    }
  });

  it('un double conserve toujours une trajectoire d’évasion', () => {
    const dist = new ObstacleLaneDistributor();
    const rng = new Rng(7);
    for (let i = 0; i < 60; i++) {
      const d = chooseObstacleLanesControlled({
        tier: 5,
        playerLane: 1,
        closedLane: null,
        existing: [],
        spawnZ: 360,
        scrollSpeed: 240,
        rng,
        distributor: dist,
        doubleBlockMul: 2,
      });
      if (!d || d.lanes.length < 2) continue;
      expect(d.lanes.length).toBe(2);
      const escape = [0, 1, 2].find((l) => !d.lanes.includes(l));
      expect(escape).toBeDefined();
    }
  });

  it('ne crée pas de double impossible avec ennemi déjà en hold', () => {
    const dist = new ObstacleLaneDistributor();
    const rng = new Rng(11);
    const existing: RoadOccupant[] = [{ lane: 2, z: 20, role: 'danger' }]; // hold droite
    for (let i = 0; i < 40; i++) {
      const d = chooseObstacleLanesControlled({
        tier: 5,
        playerLane: 1,
        closedLane: null,
        existing,
        spawnZ: 360,
        scrollSpeed: 220,
        rng,
        distributor: dist,
        doubleBlockMul: 2,
      });
      if (!d) continue;
      // Ne doit pas bloquer 0+1 si escape 2 est hold → ou alors single seulement
      if (d.lanes.length === 2) {
        expect(d.lanes.includes(2) || !d.lanes.includes(0) || !d.lanes.includes(1)).toBeTruthy();
        // Escape lane must not be the held one unless held is in the pair
        const escape = [0, 1, 2].find((l) => !d.lanes.includes(l))!;
        expect(escape).not.toBe(2);
      }
    }
  });

  it('preferredDoublePairs priorise la lane joueur', () => {
    expect(preferredDoublePairs(1)[0]).toEqual([0, 1]);
    expect(preferredDoublePairs(0)[0]).toEqual([0, 1]);
    expect(preferredDoublePairs(2)[0]).toEqual([1, 2]);
  });

  it('pickups (choosePickupLane) ≠ obstacles : favorise les côtés', () => {
    const rng = new Rng(5);
    let sides = 0;
    for (let i = 0; i < 80; i++) {
      const lane = choosePickupLane({
        playerLane: 1,
        closedLane: null,
        existing: [],
        bandZ: 380,
        scrollSpeed: 200,
        switchDuration: 0.2,
        reactionTime: 1.35,
        safetyBand: 95,
        rng,
        preferSides: true,
      });
      if (lane !== null && lane !== 1) sides++;
    }
    expect(sides).toBeGreaterThan(40);
  });

  it('simulation 1000 spawns : pas de lane absente, streak centre borné', () => {
    for (const playerLane of [0, 1, 2] as const) {
      const sim = simulateObstacleSpawns({ count: 1000, seed: 2026, playerLane, tier: 4 });
      const t = sim.distribution.total;
      // eslint-disable-next-line no-console
      console.log(
        `[sim playerLane=${playerLane}] L=${sim.distribution.left}(${((100 * sim.distribution.left) / t).toFixed(1)}%) ` +
          `C=${sim.distribution.center}(${((100 * sim.distribution.center) / t).toFixed(1)}%) ` +
          `R=${sim.distribution.right}(${((100 * sim.distribution.right) / t).toFixed(1)}%) ` +
          `maxStreakNoMid=${sim.maxStreakWithoutMiddle} impossible=${sim.impossibleAvoided} ` +
          `playerHitRate=${(sim.playerLaneHits / Math.max(1, sim.counters.singles + sim.counters.doubles)).toFixed(3)}`,
      );
      expect(sim.distribution.total).toBeGreaterThan(800);
      expect(sim.distribution.left).toBeGreaterThan(100);
      expect(sim.distribution.center).toBeGreaterThan(100);
      expect(sim.distribution.right).toBeGreaterThan(100);
      expect(sim.maxStreakWithoutMiddle).toBeLessThanOrEqual(MAX_SPAWNS_WITHOUT_MIDDLE);
    }
    expect(PLAYER_LANE_TARGET_CHANCE).toBeCloseTo(0.45, 5);
  });
});
