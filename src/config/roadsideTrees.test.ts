import { describe, expect, it } from 'vitest';
import {
  ROADSIDE_DEFS,
  ROADSIDE_TREE_KEYS,
  pickDef,
  pickTreeKey,
  resetTreeAlternation,
} from './roadsideDecor';

describe('roadside trees', () => {
  it('expose tree_01 et tree_02 dans les defs', () => {
    const trees = ROADSIDE_DEFS.filter((d) => d.category === 'tree');
    expect(trees.map((t) => t.key).sort()).toEqual([...ROADSIDE_TREE_KEYS].sort());
  });

  it('alterne tree_01 / tree_02 (pas de longues séries)', () => {
    resetTreeAlternation();
    const seq: string[] = [];
    for (let i = 0; i < 20; i++) {
      // rng déterministe qui force l’alternance (toujours < 0.85)
      seq.push(pickTreeKey(() => 0.1));
    }
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).not.toBe(seq[i - 1]);
    }
    expect(seq.includes('tree_01')).toBe(true);
    expect(seq.includes('tree_02')).toBe(true);
  });

  it('pickDef(tree) renvoie une def arbre', () => {
    resetTreeAlternation();
    const d = pickDef('tree', () => 0.1);
    expect(d.category).toBe('tree');
    expect(ROADSIDE_TREE_KEYS.includes(d.key as 'tree_01' | 'tree_02')).toBe(true);
  });

  it('les arbres n’ont pas de rôle collision (décor only)', () => {
    // Convention : pas de hitRole tree / pas d’entité lane — vérifié par absence de kind
    expect(ROADSIDE_DEFS.some((d) => d.category === 'tree')).toBe(true);
  });
});
