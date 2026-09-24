import { describe, expect, it } from 'vitest';
import {
  BUILDING_SCALE_POWER,
  PROP_SCALE_POWER,
  buildingDisplayHeight,
  buildingOverPropRatio,
  buildingScale,
  propDisplayHeight,
  propScale,
} from './roadsideScale';
import { computeLayout } from './responsiveLayout';

describe('roadsideScale — courbes', () => {
  const maxZ = 420;

  it('bâtiment croît plus vite que prop (exposant plus fort)', () => {
    expect(BUILDING_SCALE_POWER).toBeGreaterThan(PROP_SCALE_POWER);
    // À mi-chemin, le facteur building est plus bas (plus de foreshortening)
    expect(buildingScale(maxZ * 0.5, maxZ)).toBeLessThan(propScale(maxZ * 0.5, maxZ));
  });

  it('horizon petit, premier plan très grand', () => {
    const near = 700;
    const far = 70;
    expect(buildingDisplayHeight(maxZ, maxZ, near, far)).toBeCloseTo(far, 0);
    expect(buildingDisplayHeight(0, maxZ, near, far)).toBeCloseTo(near, 0);
    expect(buildingDisplayHeight(maxZ * 0.25, maxZ, near, far)).toBeGreaterThan(
      buildingDisplayHeight(maxZ * 0.6, maxZ, near, far),
    );
  });

  it('bâtiment reste nettement plus grand qu’un palmier à chaque profondeur utile', () => {
    const bNear = 700;
    const bFar = 72;
    const pNear = 160;
    const pFar = 28;
    for (const z of [20, 80, 160, 280]) {
      expect(buildingOverPropRatio(z, maxZ, bNear, bFar, pNear, pFar)).toBeGreaterThan(2.2);
    }
  });

  it('layout 1440×900 : near height suffisante pour murs de ville', () => {
    const L = computeLayout(1440, 900);
    expect(L.buildingNearHeight).toBeGreaterThanOrEqual(520);
    expect(L.buildingNearHeight).toBeGreaterThan(L.propPalmHeight * 3);
    expect(L.buildingFarHeight).toBeLessThan(L.buildingNearHeight * 0.2);
    expect(L.buildingNearHeight).toBeGreaterThan(L.browserHeight * 0.55);
  });
});

describe('roadsideScale — props', () => {
  it('prop near > prop far', () => {
    expect(propDisplayHeight(0, 420, 160, 30)).toBeGreaterThan(propDisplayHeight(420, 420, 160, 30));
  });
});
