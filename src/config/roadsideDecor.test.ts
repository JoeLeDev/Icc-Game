import { describe, expect, it } from 'vitest';
import {
  ROADSIDE_DEFS,
  STREET_PATTERNS,
  bandForCategory,
  canPlaceOnTrack,
  countBuildings,
  intervalOf,
  palmTrunkClearsBuilding,
  planRoadsideDecor,
  planSideDecor,
  requiredGap,
} from './roadsideDecor';

describe('roadsideDecor — footprints', () => {
  it('définit footprint/minGap croissants building > palm > lamp', () => {
    const building = ROADSIDE_DEFS.find((d) => d.category === 'building')!;
    const palm = ROADSIDE_DEFS.find((d) => d.category === 'palm')!;
    const lamp = ROADSIDE_DEFS.find((d) => d.category === 'lamp')!;
    expect(building.footprint).toBeGreaterThan(palm.footprint);
    expect(palm.footprint).toBeGreaterThan(lamp.footprint);
    expect(building.minGap).toBeGreaterThan(palm.minGap);
    expect(palm.minGap).toBeGreaterThan(lamp.minGap);
  });

  it('place buildings en bande FAR, props en NEAR', () => {
    expect(bandForCategory('building')).toBe('far');
    expect(bandForCategory('palm')).toBe('near');
    expect(bandForCategory('lamp')).toBe('near');
  });

  it('autorise un gap serré entre bâtiments (mur de ville)', () => {
    const b = ROADSIDE_DEFS.find((d) => d.category === 'building')!;
    const lamp = ROADSIDE_DEFS.find((d) => d.category === 'lamp')!;
    expect(requiredGap(b, b)).toBeGreaterThanOrEqual(10);
    expect(requiredGap(b, b)).toBeLessThan(b.minGap);
    expect(requiredGap(b, lamp)).toBeLessThan(b.minGap);
  });
});

describe('roadsideDecor — anti-chevauchement', () => {
  it('refuse un candidat trop proche du précédent', () => {
    const track = [{ start: 0, end: 80, category: 'building' as const }];
    expect(canPlaceOnTrack(track, 90, 80, 56)).toBe(false);
    expect(canPlaceOnTrack(track, 80 + 56, 80, 56)).toBe(true);
  });

  it('rejette un palmier au milieu d’une façade', () => {
    expect(palmTrunkClearsBuilding(100, 100, 80)).toBe(false);
    expect(palmTrunkClearsBuilding(50, 100, 80)).toBe(true);
    expect(palmTrunkClearsBuilding(150, 100, 80)).toBe(true);
  });
});

describe('roadsideDecor — composition', () => {
  it('expose plusieurs patterns de rue', () => {
    expect(STREET_PATTERNS.length).toBeGreaterThanOrEqual(4);
    expect(STREET_PATTERNS.some((p) => p.includes('building') && p.includes('palm'))).toBe(true);
  });

  it('planifie G/D sans chevauchement FAR (bâtiments)', () => {
    let s = 1;
    const rng = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const plan = planRoadsideDecor(420, rng);
    expect(plan.length).toBeGreaterThan(8);

    for (const side of [-1, 1] as const) {
      const buildings = plan.filter((p) => p.side === side && p.def.category === 'building');
      for (let i = 0; i < buildings.length; i++) {
        for (let j = i + 1; j < buildings.length; j++) {
          const a = intervalOf(buildings[i]!.z, buildings[i]!.def.footprint);
          const b = intervalOf(buildings[j]!.z, buildings[j]!.def.footprint);
          const gap = requiredGap(buildings[i]!.def, buildings[j]!.def);
          const separated = a.end + gap <= b.start || b.end + gap <= a.start;
          expect(separated).toBe(true);
        }
      }
    }
  });

  it('désynchronise les phases gauche/droite', () => {
    let s = 42;
    const rng = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const left = planSideDecor(-1, {
      maxZ: 420,
      sidePhase: { [-1]: 20, 1: 90 },
      rng,
    });
    const right = planSideDecor(1, {
      maxZ: 420,
      sidePhase: { [-1]: 20, 1: 90 },
      rng,
    });
    const leftBuildings = left.filter((p) => p.def.category === 'building').map((p) => Math.round(p.z));
    const rightBuildings = right.filter((p) => p.def.category === 'building').map((p) => Math.round(p.z));
    // Pas la même séquence de Z
    expect(leftBuildings.join(',')).not.toBe(rightBuildings.join(','));
  });

  it('limite les trous : densité bâtiments raisonnable mais présente', () => {
    let s = 7;
    const rng = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const plan = planRoadsideDecor(420, rng);
    const buildings = countBuildings(plan);
    expect(buildings).toBeGreaterThanOrEqual(8);
    expect(buildings).toBeLessThanOrEqual(28);
  });
});
