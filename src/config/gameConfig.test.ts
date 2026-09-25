import { describe, expect, it } from 'vitest';
import {
  CONFIG,
  getScrollSpeed,
  getThreatTimeScale,
  isAttackUnlocked,
  nextLaneIndex,
  readDevQuery,
} from './gameConfig';
import { DIFFICULTY_PRESETS } from './difficulty';
import {
  canReachLane,
  estimateEquipmentPaceSeconds,
  hasReachableEscape,
  pickEquipmentId,
  pickMotoSpawnLanes,
  switchesNeeded,
  timeToReact,
} from '../systems/SpawnFairness';
import {
  ObstacleLaneDistributor,
  chooseObstacleLanesControlled,
} from './obstacleSpawn';
import { Rng } from '../utils/Rng';

describe('getScrollSpeed (rééquilibrage)', () => {
  it('respecte le plafond après boost (baseline facile)', () => {
    const cap = CONFIG.speed.maxScroll * DIFFICULTY_PRESETS.easy.maxScrollMul;
    expect(getScrollSpeed(7, true, false, 'easy')).toBeLessThanOrEqual(cap + 1e-6);
  });

  it('le ralenti écrase le boost quand les deux sont actifs', () => {
    const slowOnly = getScrollSpeed(4, false, true, 'easy');
    const both = getScrollSpeed(4, true, true, 'easy');
    expect(both).toBeCloseTo(slowOnly, 5);
  });

  it('ne dépasse jamais le plafond de la difficulté', () => {
    for (const diff of ['easy', 'normal', 'hard'] as const) {
      const cap = CONFIG.speed.maxScroll * DIFFICULTY_PRESETS[diff].maxScrollMul;
      for (let eq = 0; eq <= 7; eq++) {
        expect(getScrollSpeed(eq, true, false, diff)).toBeLessThanOrEqual(cap + 1e-6);
        expect(getScrollSpeed(eq, true, true, diff)).toBeLessThanOrEqual(cap + 1e-6);
      }
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

  it('chooseObstacleLanesControlled ne renvoie jamais 3 voies', () => {
    const rng = new Rng(7);
    const dist = new ObstacleLaneDistributor();
    for (let i = 0; i < 30; i++) {
      const d = chooseObstacleLanesControlled({
        tier: 5,
        playerLane: 1,
        closedLane: null,
        existing: [],
        spawnZ: 250,
        scrollSpeed: 170,
        rng,
        distributor: dist,
      });
      if (d) expect(d.lanes.length).toBeLessThan(3);
    }
  });

  it('évite les lanes avec danger en hold (occupancy spatiale)', () => {
    const rng = new Rng(42);
    const dist = new ObstacleLaneDistributor();
    for (let i = 0; i < 20; i++) {
      const d = chooseObstacleLanesControlled({
        tier: 4,
        playerLane: 1,
        closedLane: null,
        existing: [
          { lane: 0, z: 15, role: 'danger' },
          { lane: 2, z: 18, role: 'danger' },
        ],
        spawnZ: 250,
        scrollSpeed: 200,
        rng,
        distributor: dist,
      });
      if (d) {
        expect(d.lanes.every((l) => l === 1)).toBe(true);
      }
    }
  });

  it('pickMotoSpawnLanes réserve toujours une échappatoire', () => {
    const rng = new Rng(3);
    // Double obstacle proche milieu+gauche → 0 moto (seule la droite est libre)
    const lanes = pickMotoSpawnLanes(
      1,
      null,
      [
        { lane: 0, z: 120, role: 'danger' },
        { lane: 1, z: 140, role: 'danger' },
      ],
      2,
      rng,
    );
    expect(lanes.length).toBe(0);

    // Une seule voie dangereuse → au plus 1 moto, pas sur la dernière libre seule
    const lanes2 = pickMotoSpawnLanes(
      1,
      null,
      [{ lane: 0, z: 100, role: 'danger' }],
      2,
      rng,
    );
    expect(lanes2.length).toBeLessThanOrEqual(1);
    expect(lanes2.includes(0)).toBe(false);
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
    expect(isAttackUnlocked('depression', 1, 15)).toBe(true);
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
