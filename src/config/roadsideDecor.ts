import { ROADSIDE_BUILDING_KEYS } from './displaySizes';

/** Catégorie de décor roadside */
export type RoadsideCategory = 'building' | 'palm' | 'lamp' | 'small';

/** Bande latérale : bâtiments plus loin de la chaussée */
export type RoadsideBand = 'far' | 'near';

/**
 * Emprise au sol logique (indépendante de la texture).
 * `footprint` / `minGap` sont en unités monde Z (même échelle que RoadProjection.maxZ).
 */
export type RoadsidePropDefinition = {
  key: string;
  category: RoadsideCategory;
  footprint: number;
  minGap: number;
  scaleMin: number;
  scaleMax: number;
};

export const ROADSIDE_DEFS: readonly RoadsidePropDefinition[] = [
  // Bâtiments — densés, emprise modérée (peuvent se rejoindre visuellement)
  { key: 'building_01', category: 'building', footprint: 54, minGap: 16, scaleMin: 0.92, scaleMax: 1.12 },
  { key: 'building_02', category: 'building', footprint: 54, minGap: 16, scaleMin: 0.9, scaleMax: 1.1 },
  { key: 'building_03', category: 'building', footprint: 54, minGap: 16, scaleMin: 0.88, scaleMax: 1.08 },
  { key: 'prop-palm', category: 'palm', footprint: 20, minGap: 8, scaleMin: 0.88, scaleMax: 1.12 },
  { key: 'prop-lamp', category: 'lamp', footprint: 9, minGap: 4, scaleMin: 0.9, scaleMax: 1.08 },
  { key: 'prop-lamp', category: 'small', footprint: 12, minGap: 6, scaleMin: 0.72, scaleMax: 0.88 },
] as const;

/** Patterns — plus de bâtiments pour former un mur de ville */
export const STREET_PATTERNS: readonly (readonly RoadsideCategory[])[] = [
  ['building', 'palm', 'lamp'],
  ['building', 'lamp', 'palm'],
  ['building', 'palm', 'building'],
  ['palm', 'building', 'lamp'],
  ['building', 'small', 'palm'],
  ['building', 'palm'],
  ['lamp', 'palm', 'building', 'palm'],
  ['building', 'building', 'palm'],
  ['palm', 'building', 'palm', 'lamp'],
] as const;

/** Bande latérale selon catégorie */
export function bandForCategory(category: RoadsideCategory): RoadsideBand {
  return category === 'building' ? 'far' : 'near';
}

export function defsForCategory(category: RoadsideCategory): RoadsidePropDefinition[] {
  return ROADSIDE_DEFS.filter((d) => d.category === category);
}

export function pickDef(
  category: RoadsideCategory,
  rng: () => number = Math.random,
): RoadsidePropDefinition {
  const pool = defsForCategory(category);
  if (pool.length === 0) {
    return ROADSIDE_DEFS.find((d) => d.category === 'lamp')!;
  }
  // Varier les bâtiments sans toujours reprendre le même
  if (category === 'building') {
    const keys = [...ROADSIDE_BUILDING_KEYS];
    const key = keys[Math.floor(rng() * keys.length)]!;
    return pool.find((d) => d.key === key) ?? pool[0]!;
  }
  return pool[Math.floor(rng() * pool.length)]!;
}

export function pickPattern(rng: () => number = Math.random): readonly RoadsideCategory[] {
  return STREET_PATTERNS[Math.floor(rng() * STREET_PATTERNS.length)]!;
}

/** Intervalle occupé le long de Z : [start, end] */
export type ZInterval = { start: number; end: number; category: RoadsideCategory };

export function intervalOf(zCenter: number, footprint: number): { start: number; end: number } {
  const half = footprint * 0.5;
  return { start: zCenter - half, end: zCenter + half };
}

/**
 * Gap requis entre deux éléments du même track.
 * Bâtiment↔bâtiment : gap max des deux (jamais se traverser).
 */
export function requiredGap(prev: RoadsidePropDefinition, next: RoadsidePropDefinition): number {
  if (prev.category === 'building' && next.category === 'building') {
    // Peuvent se rejoindre légèrement (perspective) — petit gap seulement
    return Math.max(10, Math.min(prev.minGap, next.minGap) * 0.55);
  }
  return Math.max(prev.minGap, next.minGap) * 0.7;
}

/**
 * Soft-overlap palm/small vs building (tracks différents) :
 * le tronc ne doit pas tomber dans le tiers central de la façade.
 */
export function palmTrunkClearsBuilding(
  palmZ: number,
  buildingZ: number,
  buildingFootprint: number,
): boolean {
  const { start, end } = intervalOf(buildingZ, buildingFootprint);
  const midStart = start + (end - start) * 0.28;
  const midEnd = start + (end - start) * 0.72;
  return palmZ < midStart || palmZ > midEnd;
}

export function canPlaceOnTrack(
  track: ZInterval[],
  candidateStart: number,
  footprint: number,
  gapFromPrev: number,
): boolean {
  const candidateEnd = candidateStart + footprint;
  for (const occ of track) {
    // Interdit si les intervals (+ gaps) se chevauchent
    if (candidateStart < occ.end + gapFromPrev && candidateEnd + gapFromPrev > occ.start) {
      return false;
    }
  }
  return true;
}

/** Placement planifié (sans sprite) — pour seed / tests */
export type PlannedDecor = {
  side: -1 | 1;
  z: number;
  def: RoadsidePropDefinition;
  scaleMul: number;
  band: RoadsideBand;
};

export type PlanOptions = {
  maxZ: number;
  /** Décalage initial Z par côté (désynchronise G/D) */
  sidePhase: Record<-1 | 1, number>;
  rng?: () => number;
};

/**
 * Compose un côté de rue par patterns successifs.
 * Tracks FAR (buildings) et NEAR (palm/lamp/small) séparés.
 */
export function planSideDecor(side: -1 | 1, opts: PlanOptions): PlannedDecor[] {
  const rng = opts.rng ?? Math.random;
  const out: PlannedDecor[] = [];
  const farTrack: ZInterval[] = [];
  const nearTrack: ZInterval[] = [];
  let cursor = opts.sidePhase[side];

  let guard = 0;
  while (cursor < opts.maxZ + 60 && guard++ < 80) {
    const pattern = pickPattern(rng);
    for (const cat of pattern) {
      const def = pickDef(cat, rng);
      const band = bandForCategory(def.category);
      const track = band === 'far' ? farTrack : nearTrack;
      const jitter = def.minGap * (0.15 + rng() * 0.45);
      const gap = (track.length === 0 ? def.minGap * 0.3 : def.minGap) + jitter;

      let candidateStart = cursor + gap * 0.35;
      if (track.length > 0) {
        const last = track[track.length - 1]!;
        candidateStart = Math.max(candidateStart, last.end + gap);
      }

      // Anti-collision sur le track
      let placed = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        const start = candidateStart + attempt * (def.footprint * 0.15 + 4);
        const gapCheck = track.length
          ? requiredGap(
              ROADSIDE_DEFS.find((d) => d.category === track[track.length - 1]!.category) ?? def,
              def,
            )
          : def.minGap;

        if (!canPlaceOnTrack(track, start, def.footprint, gapCheck * 0.85)) continue;

        const z = start + def.footprint * 0.5;

        // Soft rule : palm/small pas au milieu d’une façade
        if (band === 'near') {
          const midOk = farTrack.every((b) =>
            b.category !== 'building' || palmTrunkClearsBuilding(z, (b.start + b.end) * 0.5, b.end - b.start),
          );
          if (!midOk) continue;
        }

        track.push({ start, end: start + def.footprint, category: def.category });
        const scaleMul = def.scaleMin + rng() * (def.scaleMax - def.scaleMin);
        out.push({ side, z, def, scaleMul, band });
        cursor = Math.max(cursor, start + def.footprint);
        placed = true;
        break;
      }

      if (!placed) {
        // Skip ce slot du pattern — avance un peu pour éviter un blocage
        cursor += def.minGap + def.footprint * 0.25;
      }
    }
    // Respiration entre patterns (serrée — ville dense)
    cursor += 4 + rng() * 12;
  }

  return out;
}

/** Plan complet G+D avec phases décalées */
export function planRoadsideDecor(maxZ: number, rng: () => number = Math.random): PlannedDecor[] {
  const leftPhase = 18 + rng() * 24;
  // Droite volontairement décalée — évite la symétrie building|building
  const rightPhase = leftPhase + 48 + rng() * 55;
  return [
    ...planSideDecor(-1, { maxZ, sidePhase: { [-1]: leftPhase, 1: rightPhase }, rng }),
    ...planSideDecor(1, { maxZ, sidePhase: { [-1]: leftPhase, 1: rightPhase }, rng }),
  ];
}

/** Prochain décor pour recycler un item hors champ — toujours en bout de file */
export function planNextAfter(
  side: -1 | 1,
  existing: PlannedDecor[],
  categoryHint: RoadsideCategory | null,
  rng: () => number = Math.random,
  maxZ = 420,
): PlannedDecor {
  const sameSide = existing.filter((p) => p.side === side);
  const bandHint = categoryHint ? bandForCategory(categoryHint) : null;

  const pattern = pickPattern(rng);
  let cat = pattern[Math.floor(rng() * pattern.length)]!;
  if (bandHint === 'far') {
    cat = pattern.find((c) => bandForCategory(c) === 'far') ?? 'building';
  } else if (bandHint === 'near') {
    cat = pattern.find((c) => bandForCategory(c) === 'near') ?? (rng() < 0.55 ? 'palm' : 'lamp');
  }

  const def = pickDef(cat, rng);
  const band = bandForCategory(def.category);
  const trackItems = sameSide.filter((p) => p.band === band);
  const lastEnd = trackItems.reduce((m, p) => {
    const { end } = intervalOf(p.z, p.def.footprint);
    return Math.max(m, end);
  }, maxZ * 0.55);

  const gap = def.minGap + def.minGap * (0.25 + rng() * 0.55);
  const start = Math.max(lastEnd + gap, maxZ * 0.7 + rng() * 40);
  const z = start + def.footprint * 0.5;
  const scaleMul = def.scaleMin + rng() * (def.scaleMax - def.scaleMin);
  return { side, z, def, scaleMul, band };
}

/** Stats utiles debug / tests */
export function countBuildings(plan: PlannedDecor[]): number {
  return plan.filter((p) => p.def.category === 'building').length;
}
