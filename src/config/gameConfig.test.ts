import { describe, expect, it } from 'vitest';
import {
  CONFIG,
  getScrollSpeed,
  getThreatTimeScale,
  isAttackUnlocked,
  nextLaneIndex,
  readDevQuery,
} from './gameConfig';
import {
  canReachLane,
  chooseObstacleLanes,
  estimateEquipmentPaceSeconds,
  hasReachableEscape,
  pickEquipmentId,
  switchesNeeded,
  timeToReact,
} from '../systems/SpawnFairness';
import { Rng } from '../utils/Rng';

describe('getScrollSpeed (rééquilibrage)', () => {
  it('respecte maxScroll après boost', () => {
    expect(getScrollSpeed(7, true, false)).toBeLessThanOrEqual(CONFIG.speed.maxScroll);
  });

  it('le ralenti écrase le boost quand les deux sont actifs', () => {
    const slowOnly = getScrollSpeed(4, false, true);
    const both = getScrollSpeed(4, true, true);
    expect(both).toBeCloseTo(slowOnly, 5);
  });

  it('ne dépasse jamais maxScroll', () => {
    for (let eq = 0; eq <= 7; eq++) {
      expect(getScrollSpeed(eq, true, false)).toBeLessThanOrEqual(CONFIG.speed.maxScroll);
      expect(getScrollSpeed(eq, true, true)).toBeLessThanOrEqual(CONFIG.speed.maxScroll);
    }
  });

  it('ralentit les menaces hors scroll via getThreatTimeScale', () => {
    expect(getThreatTimeScale(true)).toBe(CONFIG.speed.slowmoMultiplier);
    expect(getThreatTimeScale(false)).toBe(1);
  });
});

describe('nextLaneIndex', () => {
  it('change d’une voie à la fois', () => {
    expect(nextLaneIndex(1, -1, null)).toBe(0);
    expect(nextLaneIndex(1, 1, null)).toBe(2);
  });

  it('saute une voie fermée si possible', () => {
    expect(nextLaneIndex(0, 1, 1)).toBe(2);
  });
});

describe('progression équipements', () => {
  it('la pace optimiste reste dans ~90–150 s', () => {
    const pace = estimateEquipmentPaceSeconds();
    expect(pace.optimistic).toBeGreaterThanOrEqual(85);
    expect(pace.optimistic).toBeLessThanOrEqual(120);
    expect(pace.withMisses).toBeGreaterThanOrEqual(90);
    expect(pace.withMisses).toBeLessThanOrEqual(170);
  });

  it('favorise les manquants — un doublon ne s’ajoute pas à la progression', () => {
    const rng = new Rng(42);
    const collected = new Set<'belt'>(['belt']);
    const picks: string[] = [];
    for (let i = 0; i < 40; i++) {
      const id = pickEquipmentId(collected as never, rng, 0.08);
      if (id) picks.push(id);
    }
    const missingCount = picks.filter((p) => p !== 'belt').length;
    expect(missingCount).toBeGreaterThan(picks.length * 0.7);
  });

  it('ne propose plus rien quand les 7 sont collectés', () => {
    const full = new Set(['belt', 'breastplate', 'shoes', 'shield', 'helmet', 'sword', 'prayer'] as const);
    expect(pickEquipmentId(full as never, new Rng(1))).toBeNull();
  });
});

describe('fairness locale (pas une garantie globale)', () => {
  it('refuse de bloquer les 3 voies', () => {
    expect(
      hasReachableEscape({
        playerLane: 1,
        closedLane: null,
        proposedBlockedLanes: [0, 1, 2],
        existing: [],
        bandZ: 220,
        scrollSpeed: 180,
        switchDuration: 0.2,
        reactionTime: 1.35,
        safetyBand: 95,
      }),
    ).toBe(false);
  });

  it('refuse un double bloc si le joueur n’a pas le temps d’atteindre la voie libre', () => {
    // bandZ très proche → temps ≈ 0, impossible de switcher de 1 vers 0
    expect(
      hasReachableEscape({
        playerLane: 1,
        closedLane: null,
        proposedBlockedLanes: [1, 2],
        existing: [],
        bandZ: 40,
        scrollSpeed: 300,
        switchDuration: 0.2,
        reactionTime: 1.35,
        safetyBand: 95,
      }),
    ).toBe(false);
  });

  it('accepte un bloc adjacent si le temps permet un switch', () => {
    expect(
      hasReachableEscape({
        playerLane: 1,
        closedLane: null,
        proposedBlockedLanes: [1],
        existing: [],
        bandZ: 280,
        scrollSpeed: 160,
        switchDuration: 0.2,
        reactionTime: 1.35,
        safetyBand: 95,
      }),
    ).toBe(true);
  });

  it('canReachLane respecte le temps de changement de voie', () => {
    expect(switchesNeeded(0, 2)).toBe(2);
    expect(canReachLane(0, 2, 0.3, 0.2)).toBe(false);
    expect(canReachLane(0, 2, 0.5, 0.2)).toBe(true);
  });

  it('timeToReact diminue avec la vitesse', () => {
    expect(timeToReact(200, 200, 1)).toBeCloseTo(0, 5);
    expect(timeToReact(200, 100, 1)).toBeCloseTo(1, 5);
  });

  it('chooseObstacleLanes ne renvoie jamais 3 voies', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 30; i++) {
      const lanes = chooseObstacleLanes(5, 1, null, [], 250, 170, rng);
      if (lanes) expect(lanes.length).toBeLessThan(3);
    }
  });

  it('voie fermée + occupants existants sont pris en compte', () => {
    expect(
      hasReachableEscape({
        playerLane: 0,
        closedLane: 2,
        proposedBlockedLanes: [0],
        existing: [{ lane: 1, z: 250, role: 'danger' }],
        bandZ: 250,
        scrollSpeed: 160,
        switchDuration: 0.2,
        reactionTime: 1.35,
        safetyBand: 95,
      }),
    ).toBe(false);
  });
});

describe('déblocage attaques', () => {
  it('introduit les familles progressivement', () => {
    expect(isAttackUnlocked('doute', 0, 30)).toBe(false);
    expect(isAttackUnlocked('doute', 1, 25)).toBe(true);
    expect(isAttackUnlocked('fromBehind', 4, 100)).toBe(false);
    expect(isAttackUnlocked('fromBehind', 5, 90)).toBe(true);
  });
});

describe('readDevQuery', () => {
  it('n’active le debug que si DEV + ?debug=1', () => {
    // En vitest, import.meta.env.DEV est typiquement true
    const on = readDevQuery('?debug=1&seed=99');
    expect(on.seed).toBe(99);
    if (import.meta.env.DEV) expect(on.debug).toBe(true);
    const off = readDevQuery('');
    expect(off.debug).toBe(false);
  });
});

describe('Rng seed', () => {
  it('reproduit la même séquence', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    expect([a.next(), a.next(), a.int(0, 2)]).toEqual([b.next(), b.next(), b.int(0, 2)]);
  });
});
