import { CONFIG, EQUIPMENTS, LANES, getTier } from '../config/gameConfig';
import type { EquipmentId } from '../config/gameConfig';
import type { Rng } from '../utils/Rng';

/** Occupant logique sur la route (pour validation locale de spawn) */
export interface RoadOccupant {
  lane: number;
  z: number;
  /** danger / collectible / other */
  role: 'danger' | 'collect' | 'neutral';
  fromBehind?: boolean;
}

export interface PathCheckInput {
  playerLane: number;
  closedLane: number | null;
  /** Nouveaux blocages proposés à la profondeur `bandZ` */
  proposedBlockedLanes: number[];
  existing: RoadOccupant[];
  bandZ: number;
  scrollSpeed: number;
  switchDuration: number;
  reactionTime: number;
  safetyBand: number;
}

/**
 * Temps disponible avant qu’un objet à `bandZ` atteigne la joueuse,
 * moins le temps de réaction.
 */
export function timeToReact(bandZ: number, scrollSpeed: number, reactionTime: number): number {
  if (scrollSpeed <= 1) return 0;
  return Math.max(0, bandZ / scrollSpeed - reactionTime);
}

export function switchesNeeded(from: number, to: number): number {
  return Math.abs(to - from);
}

export function canReachLane(
  from: number,
  to: number,
  timeAvailable: number,
  switchDuration: number,
): boolean {
  return switchesNeeded(from, to) * switchDuration <= timeAvailable + 1e-6;
}

/**
 * Validation LOCALE d’un spawn : au moins une voie libre atteignable
 * compte tenu des occupants dans la bande, de la voie fermée et du temps de switch.
 * Ne garantit pas une partie entière sans cul-de-sac.
 */
export function hasReachableEscape(input: PathCheckInput): boolean {
  const {
    playerLane,
    closedLane,
    proposedBlockedLanes,
    existing,
    bandZ,
    scrollSpeed,
    switchDuration,
    reactionTime,
    safetyBand,
  } = input;

  const blocked = new Set<number>(proposedBlockedLanes);
  if (closedLane !== null) blocked.add(closedLane);

  for (const o of existing) {
    if (o.role !== 'danger') continue;
    if (Math.abs(o.z - bandZ) > safetyBand) continue;
    if (o.fromBehind && o.z > 40) continue;
    blocked.add(o.lane);
  }

  // Ne jamais occuper les 3 voies
  if (blocked.size >= LANES) return false;

  const time = timeToReact(bandZ, scrollSpeed, reactionTime);
  for (let lane = 0; lane < LANES; lane++) {
    if (blocked.has(lane)) continue;
    if (canReachLane(playerLane, lane, time, switchDuration)) return true;
  }
  return false;
}

/**
 * Voies déjà dangereuses dans le couloir d’approche (obstacles + motos proches).
 * Utilisé pour ne pas empiler motos + doubles obstacles sans échappatoire.
 */
export function nearDangerLanes(
  existing: RoadOccupant[],
  closedLane: number | null,
  clearanceZ = CONFIG.spawn.motoClearanceZ,
): number[] {
  const blocked = new Set<number>();
  if (closedLane !== null) blocked.add(closedLane);
  for (const o of existing) {
    if (o.role !== 'danger') continue;
    if (o.fromBehind && o.z > 40) continue;
    if (o.z <= clearanceZ) blocked.add(Math.round(o.lane));
  }
  return [...blocked];
}

/**
 * Choisit 0–2 voies pour des ennemis moto en gardant TOUJOURS ≥1 voie libre
 * (hors dangers déjà dans le couloir d’approche).
 */
export function pickMotoSpawnLanes(
  playerLane: number,
  closedLane: number | null,
  existing: RoadOccupant[],
  desiredCount: number,
  rng: Rng,
  clearanceZ = CONFIG.spawn.motoClearanceZ,
): number[] {
  const occupied = new Set(nearDangerLanes(existing, closedLane, clearanceZ));
  const candidates = [0, 1, 2].filter((l) => !occupied.has(l));
  // Réserver au moins une échappatoire parmi les voies encore libres
  const maxPlace = Math.max(0, candidates.length - 1);
  const count = Math.min(Math.max(0, desiredCount), maxPlace, 2);
  if (count <= 0) return [];

  // Préférer les voies éloignées du joueur (sa voie reste échappatoire si libre)
  const ranked = [...candidates].sort((a, b) => {
    const da = Math.abs(a - playerLane);
    const db = Math.abs(b - playerLane);
    if (da !== db) return db - da; // plus loin d’abord
    return rng.next() < 0.5 ? -1 : 1;
  });

  const chosen: number[] = [];
  for (const lane of ranked) {
    if (chosen.length >= count) break;
    // Vérifie qu’après ajout il reste une voie libre atteignable
    const proposed = [...chosen, lane];
    const stillFree = [0, 1, 2].filter((l) => !occupied.has(l) && !proposed.includes(l));
    if (stillFree.length < 1) continue;
    // Le joueur doit pouvoir rejoindre au moins une voie libre (temps large : clearance)
    const time = timeToReact(clearanceZ, Math.max(120, 200), CONFIG.spawn.reactionTime);
    const reachable = stillFree.some((l) =>
      canReachLane(playerLane, l, Math.max(time, CONFIG.player.laneSwitchDuration * 2), CONFIG.player.laneSwitchDuration),
    );
    if (!reachable) continue;
    chosen.push(lane);
  }
  return chosen;
}

/** Voies libres pour un collectible : hors danger dans la bande + atteignables */
export function pickSafeCollectLane(
  input: Omit<PathCheckInput, 'proposedBlockedLanes'> & {
    rng: Rng;
    /** Évite de trop spawner bonus/équipements au milieu (défaut true) */
    preferSides?: boolean;
  },
): number | null {
  const candidates: number[] = [];
  const time = timeToReact(input.bandZ, input.scrollSpeed, input.reactionTime);
  for (let lane = 0; lane < LANES; lane++) {
    if (input.closedLane === lane) continue;
    const dangerOnLane = input.existing.some(
      (o) =>
        o.role === 'danger' &&
        o.lane === lane &&
        Math.abs(o.z - input.bandZ) < input.safetyBand,
    );
    if (dangerOnLane) continue;
    if (!canReachLane(input.playerLane, lane, time, input.switchDuration)) continue;
    candidates.push(lane);
  }
  if (!candidates.length) return null;

  const preferSides = input.preferSides !== false;
  if (preferSides && candidates.length > 1) {
    const sides = candidates.filter((l) => l !== 1);
    // ~70 % sur un côté quand c’est possible — évite l’empilement milieu
    if (sides.length && input.rng.chance(0.7)) return input.rng.pick(sides);
  }
  return input.rng.pick(candidates);
}

/**
 * Choisit un équipement : favorise fortement les manquants (doublon rare).
 * Un doublon ne doit jamais compter pour la progression (côté GameScene).
 */
export function pickEquipmentId(
  collected: ReadonlySet<EquipmentId>,
  rng: Rng,
  duplicateChance = 0.08,
): EquipmentId | null {
  const missing = EQUIPMENTS.filter((e) => !collected.has(e.id));
  if (missing.length === 0) return null;
  if (rng.chance(duplicateChance) && collected.size > 0) {
    return rng.pick([...EQUIPMENTS]).id;
  }
  return rng.pick(missing).id;
}

/** Patterns d’obstacles autorisés pour un tier (1 ou 2 voies max) */
export function chooseObstacleLanes(
  tier: number,
  playerLane: number,
  closedLane: number | null,
  existing: RoadOccupant[],
  bandZ: number,
  scrollSpeed: number,
  rng: Rng,
  doubleBlockMul = 1,
  /** Voies occupées par ennemis moto — aucun obstacle dessus */
  blockedByFoes: number[] = [],
): number[] | null {
  const t = getTier(tier);
  const doubleChance = Math.min(0.62, (CONFIG.spawn.doubleBlockChance[t] ?? 0) * doubleBlockMul);
  const midBias = CONFIG.spawn.middleLaneBias ?? 0.34;

  const isFree = (l: number) =>
    l !== closedLane && l >= 0 && l < LANES && !blockedByFoes.includes(l);

  const tryPattern = (lanes: number[]): number[] | null => {
    const unique = [...new Set(lanes)].filter(isFree);
    if (!unique.length) return null;
    if (
      !hasReachableEscape({
        playerLane,
        closedLane,
        proposedBlockedLanes: unique,
        existing,
        bandZ,
        scrollSpeed,
        switchDuration: CONFIG.player.laneSwitchDuration,
        reactionTime: CONFIG.spawn.reactionTime,
        safetyBand: CONFIG.spawn.safetyBand,
      })
    ) {
      return null;
    }
    return unique;
  };

  const pool = [0, 1, 2].filter(isFree);
  if (!pool.length) return null;

  // Doubles : paires équiprobables (0-1, 1-2, 0-2) — pas de favoritisme milieu
  if (rng.chance(doubleChance) && t >= 1 && pool.length >= 2) {
    const pairs: number[][] = [];
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        pairs.push([pool[i]!, pool[j]!]);
      }
    }
    for (const pair of rng.shuffle(pairs)) {
      const ok = tryPattern(pair);
      if (ok) return ok;
    }
  }

  // Simple : répartition ≈ égale (middleLaneBias ≈ 1/3)
  const lane = pickWeightedLane(pool, rng, midBias);
  const single = tryPattern([lane]);
  if (single) return single;
  // Dernier recours : n’importe quelle voie libre atteignable
  for (const l of rng.shuffle(pool)) {
    const ok = tryPattern([l]);
    if (ok) return ok;
  }
  return null;
}

/**
 * Pondération voie : milieu ≈ midBias (~1/3), côtés se partagent le reste.
 */
export function pickWeightedLane(pool: number[], rng: Rng, midBias = 1 / 3): number {
  if (pool.length === 1) return pool[0]!;
  const hasMid = pool.includes(1);
  const sideCount = pool.filter((l) => l !== 1).length;
  const weights = pool.map((l) => {
    if (l === 1) return hasMid ? midBias : 0;
    return sideCount > 0 ? (1 - (hasMid ? midBias : 0)) / sideCount : 0;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * Math.max(1e-6, sum);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

export function estimateEquipmentPaceSeconds(): {
  optimistic: number;
  withMisses: number;
} {
  const first = CONFIG.spawn.firstEquipmentDelay;
  const intervals = CONFIG.spawn.equipmentInterval;
  let sum = first;
  for (let i = 0; i < 6; i++) sum += intervals[i]!;
  return {
    optimistic: sum,
    /** +~35 % si quelques ratés / respiration */
    withMisses: sum * 1.35,
  };
}
