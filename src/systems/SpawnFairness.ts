import { CONFIG, EQUIPMENTS, EquipmentId, LANES, getTier } from '../config/gameConfig';
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

/** Voies libres pour un collectible : hors danger dans la bande + atteignables */
export function pickSafeCollectLane(
  input: Omit<PathCheckInput, 'proposedBlockedLanes'> & { rng: Rng },
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
): number[] | null {
  const t = getTier(tier);
  const doubleChance = CONFIG.spawn.doubleBlockChance[t] ?? 0;
  const preferAway = t < 4;

  const tryPattern = (lanes: number[]): number[] | null => {
    const unique = [...new Set(lanes)].filter((l) => l !== closedLane && l >= 0 && l < LANES);
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

  if (rng.chance(doubleChance) && t >= 2) {
    const shuffled = rng.shuffle([0, 1, 2]);
    const pair = shuffled.slice(0, 2);
    const ok = tryPattern(pair);
    if (ok) return ok;
  }

  // Une seule voie — souvent hors de la voie actuelle en early game
  let pool = [0, 1, 2].filter((l) => l !== closedLane);
  if (preferAway && pool.length > 1) {
    const away = pool.filter((l) => l !== playerLane);
    if (away.length) pool = away;
  }
  const single = tryPattern([rng.pick(pool)]);
  return single;
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
