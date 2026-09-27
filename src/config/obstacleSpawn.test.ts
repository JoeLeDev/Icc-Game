import { describe, expect, it } from 'vitest';
import {
  MAX_SPAWNS_WITHOUT_MIDDLE,
  ObstacleLaneDistributor,
  chooseObstacleLanesControlled,
  isLaneSafeAtDepth,
  preferredDoublePairs,
  simulateObstacleSpawns,
} from './obstacleSpawn';
import { choosePickupLane } from './obstacleSpawn';
import { Rng } from '../utils/Rng';
import { CONFIG, getScrollSpeed, getSpawnReactionTime } from './gameConfig';
import { horizonSpawnZ } from './laneOccupancy';
import { DIFFICULTY_IDS } from './difficulty';
import { canReachLane, timeToReact } from '../systems/SpawnFairness';
import type { RoadOccupant } from '../systems/SpawnFairness';

describe('obstacleSpawn — distribution contrôlée', () => {
  it.each(DIFFICULTY_IDS)('alterne les trois voies dès le départ en difficulté %s', difficulty => {
    const distributor = new ObstacleLaneDistributor();
    const scrollSpeed = getScrollSpeed(0, false, false, difficulty);
    const spawnZ = horizonSpawnZ(420);
    const rng = new Rng(42);
    const lanes: number[] = [];
    let existing: RoadOccupant[] = [];
    for (let i = 0; i < 9; i++) {
      existing = existing.map(o => ({ ...o, z: o.z - 340 })).filter(o => o.z > 0);
      const decision = chooseObstacleLanesControlled({ tier: 0, playerLane: 1, closedLane: null, existing, spawnZ, scrollSpeed, rng, distributor });
      expect(decision).not.toBeNull();
      lanes.push(...decision!.lanes);
      distributor.recordFinal(decision!.lanes);
      for (const lane of decision!.lanes) existing.push({ lane, z: spawnZ, role: 'danger' });
      if (decision!.lanes.includes(1)) {
        expect(canReachLane(1, 0, timeToReact(spawnZ, scrollSpeed, getSpawnReactionTime(scrollSpeed)), CONFIG.player.laneSwitchDuration)).toBe(true);
      }
    }
    expect(lanes).toEqual([1, 0, 2, 1, 0, 2, 1, 0, 2]);
    distributor.reset();
    expect(distributor.singleLaneOrder()[0]).toBe(1);
  });

  it('ne compte pas une apparition annulée comme un obstacle central', () => {
    const distributor = new ObstacleLaneDistributor();
    const input = { tier: 0, playerLane: 1, closedLane: null, existing: [], spawnZ: horizonSpawnZ(420), scrollSpeed: getScrollSpeed(0, false, false), rng: new Rng(7), distributor };
    expect(chooseObstacleLanesControlled(input)?.lanes).toEqual([1]);
    distributor.recordFinal([]);
    expect(distributor.counters.center).toBe(0);
    expect(chooseObstacleLanesControlled(input)?.lanes).toEqual([1]);
  });

  it('saute une voie fermée et la réintègre quand elle redevient disponible', () => {
    const distributor = new ObstacleLaneDistributor();
    const input = { tier: 0, playerLane: 0, closedLane: 1 as number | null, existing: [], spawnZ: horizonSpawnZ(420), scrollSpeed: getScrollSpeed(0, false, false), rng: new Rng(7), distributor };
    const first = chooseObstacleLanesControlled(input)!;
    expect(first.lanes).not.toContain(1);
    distributor.recordFinal(first.lanes);
    input.closedLane = null;
    const next = chooseObstacleLanesControlled(input)!;
    distributor.recordFinal(next.lanes);
    expect(chooseObstacleLanesControlled(input)?.lanes).toContain(1);
  });

  it('n’impose pas le centre si le temps de changement de voie est insuffisant', () => {
    const distributor = new ObstacleLaneDistributor();
    const decision = chooseObstacleLanesControlled({ tier: 0, playerLane: 1, closedLane: null, existing: [], spawnZ: 30, scrollSpeed: 800, rng: new Rng(2), distributor });
    expect(getSpawnReactionTime(800)).toBeGreaterThanOrEqual(CONFIG.spawn.minReactionTime);
    expect(decision?.lanes).not.toContain(1);
  });
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
      dist.recordFinal(d!.lanes);
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
      // Singles alternés (~1/3 par voie) et doubles orientés vers la voie joueur.
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
  });
});
