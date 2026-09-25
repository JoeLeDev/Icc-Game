import { describe, expect, it } from 'vitest';
import {
  ENEMY_SIDE_RATIO,
  MOTO_ATTACK_PROFILE,
  MOTO_SHOOT_INTERVAL,
  MOTO_SIDE_HITS_TO_DEFEAT,
  MAX_MOTO_FOES,
  classifyEnemyRam,
  createEnemyAttackState,
  enemyZoneRects,
  isRammableEnemyKind,
  onEnemyReceivedPlayerHit,
  sideHitDefeats,
  tickEnemyAttack,
  type EnemyAttackProfile,
  type EnemyAttackState,
} from './enemyRamming';
import { makeHitRect } from '../systems/Hitbox';

function box(x: number, y: number, w: number, h: number) {
  return makeHitRect(x, y, w, h, 0, 0);
}

const PROFILE: EnemyAttackProfile = {
  ...MOTO_ATTACK_PROFILE,
  firstAttackDelay: 0, // tests : prêt immédiatement après hold
  windupDuration: 0.3,
  attackCooldown: 3,
  hitRecoveryDuration: 3,
};

function advance(
  state: EnemyAttackState,
  profile: EnemyAttackProfile,
  seconds: number,
  step = 0.05,
): { state: EnemyAttackState; fires: number } {
  let s = state;
  let fires = 0;
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    const r = tickEnemyAttack(s, profile, dt);
    s = r.state;
    if (r.shouldFire) fires += 1;
    left -= dt;
  }
  return { state: s, fires };
}

describe('enemyRamming', () => {
  it('reconnaît les ennemis percutables', () => {
    expect(isRammableEnemyKind('depression')).toBe(true);
    expect(isRammableEnemyKind('peur')).toBe(true);
    expect(isRammableEnemyKind('obstacle')).toBe(false);
    expect(isRammableEnemyKind('car')).toBe(false);
  });

  it('collision centrée depuis l’arrière = rear (joueur perd)', () => {
    const enemy = box(200, 400, 80, 100);
    const player = box(200, 455, 60, 90);
    expect(classifyEnemyRam(player, enemy)).toBe('rear');
  });

  it('collision flanc gauche = side_left', () => {
    const enemy = box(200, 400, 80, 100);
    const player = box(155, 420, 60, 90);
    expect(classifyEnemyRam(player, enemy)).toBe('side_left');
  });

  it('collision flanc droit = side_right', () => {
    const enemy = box(200, 400, 80, 100);
    const player = box(245, 420, 60, 90);
    expect(classifyEnemyRam(player, enemy)).toBe('side_right');
  });

  it('2 coups latéraux pour vaincre, max 2 foes, cooldown 3s', () => {
    expect(sideHitDefeats(1)).toBe(false);
    expect(sideHitDefeats(MOTO_SIDE_HITS_TO_DEFEAT)).toBe(true);
    expect(MAX_MOTO_FOES).toBe(2);
    expect(MOTO_SHOOT_INTERVAL).toBe(3);
    expect(MOTO_ATTACK_PROFILE.attackCooldown).toBe(3);
    expect(MOTO_ATTACK_PROFILE.resetAttackCooldownOnHit).toBe(true);
  });

  it('zones rear/left/right plus petites que le corps', () => {
    const enemy = box(200, 400, 100, 120);
    const z = enemyZoneRects(enemy);
    expect(z.rear.w).toBeLessThan(enemy.w);
    expect(z.left.w).toBeLessThan(enemy.w * 0.4);
    expect(z.right.w).toBeLessThan(enemy.w * 0.4);
    expect(ENEMY_SIDE_RATIO).toBeGreaterThan(0.3);
  });
});

describe('enemyAttackCooldown — reset sur impact joueur', () => {
  it('1. ennemi non touché → peut attaquer après ~3 s (+ windup)', () => {
    let state = createEnemyAttackState({ ...PROFILE, firstAttackDelay: 3 });
    const early = advance(state, PROFILE, 2.9);
    expect(early.fires).toBe(0);
    state = early.state;
    const late = advance(state, PROFILE, 0.5); // passe windup
    expect(late.fires).toBe(1);
  });

  it('2. impact à 2.5 s → attaque repoussée de 3 s', () => {
    let state = createEnemyAttackState({ ...PROFILE, firstAttackDelay: 3 });
    state = advance(state, PROFILE, 2.5).state;
    const hit = onEnemyReceivedPlayerHit(state, PROFILE, 1);
    expect(hit.didReset).toBe(true);
    state = hit.state;
    expect(state.timer).toBeCloseTo(3, 5);
    expect(state.phase).toBe('cooldown');
    // Entre 2.5 et 5.0 (ancien créneau) : aucun tir
    const blocked = advance(state, PROFILE, 2.9);
    expect(blocked.fires).toBe(0);
    // Après recovery + windup → tir
    const after = advance(blocked.state, PROFILE, 0.5);
    expect(after.fires).toBe(1);
  });

  it('3. deuxième impact → nouveau reset complet', () => {
    let state = createEnemyAttackState({ ...PROFILE, firstAttackDelay: 3 });
    state = advance(state, PROFILE, 1.0).state;
    state = onEnemyReceivedPlayerHit(state, PROFILE, 1).state;
    expect(state.timer).toBeCloseTo(3, 5);

    state = advance(state, PROFILE, 2.2).state; // t≈3.2 depuis début, 0.8 restant
    state = onEnemyReceivedPlayerHit(state, PROFILE, 2).state;
    expect(state.timer).toBeCloseTo(3, 5);
    expect(state.phase).toBe('cooldown');

    const stillBlocked = advance(state, PROFILE, 2.9);
    expect(stillBlocked.fires).toBe(0);
    const fire = advance(stillBlocked.state, PROFILE, 0.5);
    expect(fire.fires).toBe(1);
  });

  it('4. impact pendant windup → attaque annulée', () => {
    // firstAttackDelay 0 → entre immédiatement en windup au 1er tick
    let state = createEnemyAttackState({ ...PROFILE, firstAttackDelay: 0 });
    state = advance(state, PROFILE, 0.05).state;
    expect(state.phase).toBe('windup');

    const hit = onEnemyReceivedPlayerHit(state, PROFILE, 10);
    expect(hit.didReset).toBe(true);
    expect(hit.cancelledWindup).toBe(true);
    expect(hit.state.phase).toBe('cooldown');
    expect(hit.state.timer).toBeCloseTo(3, 5);

    const noFire = advance(hit.state, PROFILE, 2.9);
    expect(noFire.fires).toBe(0);
  });

  it('5. projectile déjà tiré → reste actif (le reset ne le concerne pas)', () => {
    let state = createEnemyAttackState({ ...PROFILE, firstAttackDelay: 0, windupDuration: 0 });
    const fired = tickEnemyAttack(state, { ...PROFILE, windupDuration: 0 }, 0.01);
    expect(fired.shouldFire).toBe(true);
    // Simule un projectile déjà créé côté scène — le state machine ne le touche pas
    const projectileAlive = { active: true };
    state = onEnemyReceivedPlayerHit(fired.state, PROFILE, 1).state;
    expect(projectileAlive.active).toBe(true);
    expect(state.phase).toBe('cooldown');
    expect(state.timer).toBeCloseTo(3, 5);
  });

  it('6. simple overlap sans attaque valide → aucun reset', () => {
    // rear n’est pas un impact offensif joueur — on n’appelle pas onEnemyReceivedPlayerHit
    const enemy = box(200, 400, 80, 100);
    const player = box(200, 455, 60, 90);
    expect(classifyEnemyRam(player, enemy)).toBe('rear');

    let state = createEnemyAttackState({ ...PROFILE, firstAttackDelay: 1 });
    state = advance(state, PROFILE, 0.5).state;
    const timerBefore = state.timer;
    // Pas d’appel reset → timer inchangé si on ne tick pas
    expect(state.timer).toBeCloseTo(timerBefore, 5);
    expect(state.lastHitSerial).toBe(-1);
  });

  it('7. plusieurs callbacks sur le même impact → un seul reset', () => {
    let state = createEnemyAttackState({ ...PROFILE, firstAttackDelay: 1 });
    state = advance(state, PROFILE, 0.4).state;
    const first = onEnemyReceivedPlayerHit(state, PROFILE, 42);
    expect(first.didReset).toBe(true);
    state = first.state;
    // Même serial → ignoré
    const second = onEnemyReceivedPlayerHit(state, PROFILE, 42);
    expect(second.didReset).toBe(false);
    expect(second.state.timer).toBeCloseTo(3, 5);
    // Serial différent → nouveau reset
    const third = onEnemyReceivedPlayerHit(second.state, PROFILE, 43);
    expect(third.didReset).toBe(true);
    expect(third.state.timer).toBeCloseTo(3, 5);
  });

  it('profil sans resetAttackCooldownOnHit → impact ignoré', () => {
    const heavy: EnemyAttackProfile = {
      ...PROFILE,
      resetAttackCooldownOnHit: false,
      firstAttackDelay: 1,
    };
    let state = createEnemyAttackState(heavy);
    state = advance(state, heavy, 0.5).state;
    const hit = onEnemyReceivedPlayerHit(state, heavy, 1);
    expect(hit.didReset).toBe(false);
    expect(hit.state.timer).toBeCloseTo(state.timer, 5);
  });
});
