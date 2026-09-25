/**
 * Spawn d’obstacles contrôlé (gameplay-first).
 *
 * Cause historique du “centre trop confortable” :
 * 1. Singles ≈ 1/3 indépendant sans cibler la lane joueur ;
 * 2. Doubles équiprobables → 1/3 LEFT+RIGHT laisse le centre libre ;
 * 3. `blockedByFoes` bloquait toute la lane moto sans gap Z ;
 * 4. Aucun anti-streak → longues séries sans obstacle central ;
 * 5. Fallback après rejet poussait souvent vers les côtés.
 */

import { CONFIG, LANES, getTier } from './gameConfig';
import {
  type RoadOccupant,
  canReachLane,
  hasReachableEscape,
  timeToReact,
} from '../systems/SpawnFairness';
import { Rng } from '../utils/Rng';

export const OBSTACLE_HISTORY_SIZE = 8;
export const MAX_SPAWNS_WITHOUT_MIDDLE = 3;
/** Probabilité qu’un single cible la lane actuelle du joueur */
export const PLAYER_LANE_TARGET_CHANCE = 0.45;

export type ObstacleSpawnMode = 'single' | 'double';

export type LaneReject = { lane: number | number[]; reason: string };

export type ObstacleSpawnDecision = {
  lanes: number[];
  mode: ObstacleSpawnMode;
  requested: number[];
  rejected: LaneReject[];
  spawnZ: number;
  playerLane: number;
  spawnsWithoutMiddle: number;
  forcedMiddle: boolean;
};

export type ObstacleSpawnDebugCounters = {
  left: number;
  center: number;
  right: number;
  singles: number;
  doubles: number;
  impossibleAvoided: number;
  maxStreakWithoutMiddle: number;
};

export function isObstacleSpawnDebugEnabled(
  search = typeof location !== 'undefined' ? location.search : '',
): boolean {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('ICC_DEBUG_OBSTACLE_SPAWN') === '1') {
      return true;
    }
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { ICC_DEBUG_OBSTACLE_SPAWN?: number }).ICC_DEBUG_OBSTACLE_SPAWN === 1
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  const params = new URLSearchParams(search);
  return params.get('obstacleSpawnDebug') === '1' || params.get('ICC_DEBUG_OBSTACLE_SPAWN') === '1';
}

/** Occupancy spatiale : même lane OK si |Δz| ≥ minGap */
export function isLaneSafeAtDepth(
  lane: number,
  spawnZ: number,
  existing: RoadOccupant[],
  opts: {
    minGap: number;
    closedLane: number | null;
    /** Motos/hold : bloquent si proches en Z OU déjà au plan joueur (z bas) */
    holdBlockZ?: number;
  },
): { ok: boolean; reason?: string } {
  if (lane < 0 || lane >= LANES) return { ok: false, reason: 'lane_out_of_range' };
  if (opts.closedLane !== null && lane === opts.closedLane) {
    return { ok: false, reason: 'lane_closed' };
  }
  const holdZ = opts.holdBlockZ ?? CONFIG.spawn.motoClearanceZ;
  for (const o of existing) {
    if (o.role !== 'danger') continue;
    if (Math.round(o.lane) !== lane) continue;
    if (o.fromBehind && o.z > 40) continue;
    // Hold / proche joueur : lane indisponible pour un nouvel obstacle
    if (o.z <= holdZ * 0.35) {
      return { ok: false, reason: `danger_holding_lane_z=${o.z.toFixed(0)}` };
    }
    if (Math.abs(o.z - spawnZ) < opts.minGap) {
      return { ok: false, reason: `gap_too_small_dz=${Math.abs(o.z - spawnZ).toFixed(0)}` };
    }
  }
  return { ok: true };
}

export class ObstacleLaneDistributor {
  /** Historique des lanes FINALES (un entry par objet placé) */
  recentObstacleLanes: number[] = [];
  /** Spawns d’événements (single ou double) sans aucun obstacle centre */
  spawnsWithoutMiddle = 0;
  counters: ObstacleSpawnDebugCounters = {
    left: 0,
    center: 0,
    right: 0,
    singles: 0,
    doubles: 0,
    impossibleAvoided: 0,
    maxStreakWithoutMiddle: 0,
  };

  reset(): void {
    this.recentObstacleLanes = [];
    this.spawnsWithoutMiddle = 0;
    this.counters = {
      left: 0,
      center: 0,
      right: 0,
      singles: 0,
      doubles: 0,
      impossibleAvoided: 0,
      maxStreakWithoutMiddle: 0,
    };
  }

  recordFinal(lanes: number[]): void {
    const hadMiddle = lanes.includes(1);
    if (hadMiddle) this.spawnsWithoutMiddle = 0;
    else {
      this.spawnsWithoutMiddle += 1;
      this.counters.maxStreakWithoutMiddle = Math.max(
        this.counters.maxStreakWithoutMiddle,
        this.spawnsWithoutMiddle,
      );
    }
    for (const l of lanes) {
      this.recentObstacleLanes.push(l);
      while (this.recentObstacleLanes.length > OBSTACLE_HISTORY_SIZE) {
        this.recentObstacleLanes.shift();
      }
      if (l === 0) this.counters.left++;
      else if (l === 1) this.counters.center++;
      else if (l === 2) this.counters.right++;
    }
    if (lanes.length >= 2) this.counters.doubles++;
    else if (lanes.length === 1) this.counters.singles++;
  }

  /** Pression historique : lanes sous-représentées → score ↑ */
  historyBoost(lane: number): number {
    const hist = this.recentObstacleLanes;
    if (hist.length < 3) return 1;
    const count = hist.filter((l) => l === lane).length;
    const expected = hist.length / 3;
    if (count < expected - 0.5) return 1.55;
    if (count > expected + 1.2) return 0.55;
    return 1;
  }
}

export type ChooseObstacleInput = {
  tier: number;
  playerLane: number;
  closedLane: number | null;
  existing: RoadOccupant[];
  spawnZ: number;
  scrollSpeed: number;
  rng: Rng;
  distributor: ObstacleLaneDistributor;
  doubleBlockMul?: number;
  minGap?: number;
  debug?: boolean;
};

function escapeLaneOf(pair: [number, number]): number {
  return ([0, 1, 2] as const).find((l) => l !== pair[0] && l !== pair[1])!;
}

/** Doubles orientés gameplay : bloquer la trajectoire joueur, 1 évasion lisible */
export function preferredDoublePairs(playerLane: number): [number, number][] {
  // Toujours lister d’abord les paires qui incluent la lane joueur
  if (playerLane === 1) {
    return [
      [0, 1], // escape RIGHT
      [1, 2], // escape LEFT
      [0, 2], // escape CENTER (moins prioritaire)
    ];
  }
  if (playerLane === 0) {
    return [
      [0, 1], // escape RIGHT
      [0, 2], // escape CENTER
      [1, 2],
    ];
  }
  return [
    [1, 2], // escape LEFT
    [0, 2], // escape CENTER
    [0, 1],
  ];
}

function validatePattern(
  lanes: number[],
  input: ChooseObstacleInput,
  minGap: number,
  rejected: LaneReject[],
): number[] | null {
  const unique = [...new Set(lanes)].filter((l) => l >= 0 && l < LANES);
  if (!unique.length) return null;

  for (const lane of unique) {
    const safe = isLaneSafeAtDepth(lane, input.spawnZ, input.existing, {
      minGap,
      closedLane: input.closedLane,
    });
    if (!safe.ok) {
      rejected.push({ lane, reason: safe.reason ?? 'unsafe' });
      return null;
    }
  }

  if (
    !hasReachableEscape({
      playerLane: input.playerLane,
      closedLane: input.closedLane,
      proposedBlockedLanes: unique,
      existing: input.existing,
      bandZ: input.spawnZ,
      scrollSpeed: input.scrollSpeed,
      switchDuration: CONFIG.player.laneSwitchDuration,
      reactionTime: CONFIG.spawn.reactionTime,
      safetyBand: Math.max(CONFIG.spawn.safetyBand, minGap),
    })
  ) {
    rejected.push({ lane: unique, reason: 'no_reachable_escape' });
    input.distributor.counters.impossibleAvoided++;
    return null;
  }

  // Double : la 3ᵉ lane doit être praticable (safe + atteignable)
  if (unique.length === 2) {
    const escape = escapeLaneOf(unique as [number, number]);
    const escSafe = isLaneSafeAtDepth(escape, input.spawnZ, input.existing, {
      minGap,
      closedLane: input.closedLane,
    });
    if (!escSafe.ok) {
      rejected.push({ lane: unique, reason: `escape_lane_${escape}_unsafe:${escSafe.reason}` });
      input.distributor.counters.impossibleAvoided++;
      return null;
    }
    const time = timeToReact(input.spawnZ, input.scrollSpeed, CONFIG.spawn.reactionTime);
    if (!canReachLane(input.playerLane, escape, time, CONFIG.player.laneSwitchDuration)) {
      rejected.push({ lane: unique, reason: `escape_lane_${escape}_unreachable` });
      input.distributor.counters.impossibleAvoided++;
      return null;
    }
  }

  return unique;
}

function pickSingleLane(input: ChooseObstacleInput, forceMiddle: boolean): number | null {
  const { rng, playerLane, distributor } = input;
  const others = [0, 1, 2].filter((l) => l !== playerLane);

  if (forceMiddle) return 1;

  // 45 % lane joueur, 27.5 % chacune des autres — puis × historyBoost
  const weights = [0, 1, 2].map((lane) => {
    let w = lane === playerLane ? PLAYER_LANE_TARGET_CHANCE : (1 - PLAYER_LANE_TARGET_CHANCE) / 2;
    w *= distributor.historyBoost(lane);
    // Anti-streak soft : si centre absent récemment, boost centre
    if (lane === 1 && distributor.spawnsWithoutMiddle >= 2) w *= 1.4;
    return w;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * sum;
  for (let i = 0; i < 3; i++) {
    r -= weights[i]!;
    if (r <= 0) return i;
  }
  return rng.pick(others.length ? others : [playerLane]);
}

/**
 * Choix FINAL des lanes obstacle (après validations).
 * Ne se contente pas d’un tirage middleLaneBias isolé.
 */
export function chooseObstacleLanesControlled(input: ChooseObstacleInput): ObstacleSpawnDecision | null {
  const t = getTier(input.tier);
  const minGap = input.minGap ?? CONFIG.spawn.minGapFront;
  const doubleMul = input.doubleBlockMul ?? 1;
  const doubleChance = Math.min(
    0.55,
    (CONFIG.spawn.doubleBlockChance[t] ?? 0) * doubleMul,
  );
  // Early game : moins de doubles
  const effectiveDoubleChance = t < 2 ? doubleChance * 0.45 : doubleChance;

  const rejected: LaneReject[] = [];
  const forceMiddle =
    input.distributor.spawnsWithoutMiddle >= MAX_SPAWNS_WITHOUT_MIDDLE;

  let mode: ObstacleSpawnMode = 'single';
  let requested: number[] = [];
  let finalLanes: number[] | null = null;

  // ——— Doubles (si pas force middle pur, ou force middle via paire centre) ———
  if (!forceMiddle && input.rng.chance(effectiveDoubleChance) && t >= 1) {
    mode = 'double';
    for (const pair of preferredDoublePairs(input.playerLane)) {
      requested = [...pair];
      finalLanes = validatePattern(pair, input, minGap, rejected);
      if (finalLanes) break;
    }
  }

  // Force middle : single centre, sinon double incluant centre
  if (!finalLanes && forceMiddle) {
    mode = 'single';
    requested = [1];
    finalLanes = validatePattern([1], input, minGap, rejected);
    if (!finalLanes) {
      mode = 'double';
      for (const pair of preferredDoublePairs(input.playerLane).filter((p) => p.includes(1))) {
        requested = [...pair];
        finalLanes = validatePattern(pair, input, minGap, rejected);
        if (finalLanes) break;
      }
    }
  }

  // ——— Singles avec ciblage joueur + historique ———
  if (!finalLanes) {
    mode = 'single';
    const order: number[] = [];
    const first = pickSingleLane(input, false);
    if (first != null) order.push(first);
    for (const l of input.rng.shuffle([0, 1, 2])) {
      if (!order.includes(l)) order.push(l);
    }
    for (const lane of order) {
      requested = [lane];
      finalLanes = validatePattern([lane], input, minGap, rejected);
      if (finalLanes) break;
    }
  }

  if (!finalLanes) {
    if (input.debug || isObstacleSpawnDebugEnabled()) {
      console.info('[obstacleSpawn] ABORT', { rejected, playerLane: input.playerLane, spawnZ: input.spawnZ });
    }
    return null;
  }

  const decision: ObstacleSpawnDecision = {
    lanes: finalLanes,
    mode: finalLanes.length >= 2 ? 'double' : mode,
    requested,
    rejected,
    spawnZ: input.spawnZ,
    playerLane: input.playerLane,
    spawnsWithoutMiddle: input.distributor.spawnsWithoutMiddle,
    forcedMiddle: forceMiddle && finalLanes.includes(1),
  };

  input.distributor.recordFinal(finalLanes);

  if (input.debug || isObstacleSpawnDebugEnabled()) {
    console.info('[obstacleSpawn]', {
      type: decision.mode,
      requested: decision.requested,
      final: decision.lanes,
      playerLane: decision.playerLane,
      spawnZ: decision.spawnZ,
      forcedMiddle: decision.forcedMiddle,
      spawnsWithoutMiddle: decision.spawnsWithoutMiddle,
      rejected: decision.rejected,
      near: input.existing
        .filter((o) => o.role === 'danger' && Math.abs(o.z - input.spawnZ) < minGap * 1.5)
        .map((o) => ({ lane: o.lane, z: o.z })),
      counters: { ...input.distributor.counters },
    });
  }

  return decision;
}

/** Alias explicite pickups — stratégie séparée des obstacles */
export { pickSafeCollectLane as choosePickupLane } from '../systems/SpawnFairness';

/**
 * Simulation batch pour stats (tests / rapport).
 * Fait avancer de faux occupants pour simuler le scroll.
 */
export function simulateObstacleSpawns(opts: {
  count: number;
  seed: number;
  playerLane?: number | (() => number);
  tier?: number;
  scrollSpeed?: number;
  spawnZ?: number;
}): {
  counters: ObstacleSpawnDebugCounters;
  distribution: { left: number; center: number; right: number; total: number };
  maxStreakWithoutMiddle: number;
  impossibleAvoided: number;
  playerLaneHits: number;
  singles: number;
} {
  const rng = new Rng(opts.seed);
  const dist = new ObstacleLaneDistributor();
  const scrollSpeed = opts.scrollSpeed ?? 220;
  const spawnZ = opts.spawnZ ?? 380;
  const tier = opts.tier ?? 4;
  let existing: RoadOccupant[] = [];
  let playerLaneHits = 0;
  let playerLane =
    typeof opts.playerLane === 'function' ? opts.playerLane() : (opts.playerLane ?? 1);

  for (let i = 0; i < opts.count; i++) {
    if (typeof opts.playerLane === 'function') playerLane = opts.playerLane();
    // Scroll approx : rapproche les dangers
    existing = existing
      .map((o) => ({ ...o, z: o.z - scrollSpeed * 1.6 }))
      .filter((o) => o.z > -40);

    const decision = chooseObstacleLanesControlled({
      tier,
      playerLane,
      closedLane: null,
      existing,
      spawnZ,
      scrollSpeed,
      rng,
      distributor: dist,
      doubleBlockMul: 1,
      debug: false,
    });
    if (!decision) continue;
    if (decision.lanes.includes(playerLane)) playerLaneHits++;
    for (const lane of decision.lanes) {
      existing.push({ lane, z: spawnZ, role: 'danger' });
    }
  }

  const total = dist.counters.left + dist.counters.center + dist.counters.right;
  return {
    counters: dist.counters,
    distribution: {
      left: dist.counters.left,
      center: dist.counters.center,
      right: dist.counters.right,
      total,
    },
    maxStreakWithoutMiddle: dist.counters.maxStreakWithoutMiddle,
    impossibleAvoided: dist.counters.impossibleAvoided,
    playerLaneHits,
    singles: dist.counters.singles,
  };
}
