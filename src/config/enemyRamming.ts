import type { HitRect } from '../systems/Hitbox';

/** Ennemis percutables à moto (pas les obstacles inertes / pickups). */
export const RAMMABLE_ENEMY_KINDS = ['depression', 'peur'] as const;
export type RammableEnemyKind = (typeof RAMMABLE_ENEMY_KINDS)[number];

export function isRammableEnemyKind(kind: string): kind is RammableEnemyKind {
  return (RAMMABLE_ENEMY_KINDS as readonly string[]).includes(kind);
}

export type EnemyRamResult = 'rear' | 'side_left' | 'side_right';

/** Coups de flanc nécessaires pour éliminer un ennemi moto */
export const MOTO_SIDE_HITS_TO_DEFEAT = 2;

/** Profondeur où l’ennemi moto reste au niveau du joueur (z≈0 = même Y écran) */
export const MOTO_HOLD_Z = 0;

/** Max d’ennemis moto simultanés (jamais 3) */
export const MAX_MOTO_FOES = 2;

/** I-frames après un coup latéral (évite double comptage) */
export const MOTO_RAM_IFRAMES = 0.55;

/**
 * Profil d’attaque configurable (motos / futurs mobs).
 * Durées en secondes.
 */
export type EnemyAttackProfile = {
  /** Cooldown offensif de base après un tir */
  attackCooldown: number;
  /** Si true : impact joueur réussi → reset cooldown complet */
  resetAttackCooldownOnHit: boolean;
  /** Durée du cooldown après reset (souvent = attackCooldown) */
  hitRecoveryDuration: number;
  /** Télégraphie avant le tir (annulable par un impact) */
  windupDuration: number;
  /** Délai avant le 1er tir après arriver au hold */
  firstAttackDelay: number;
};

/** Profil moto standard */
export const MOTO_ATTACK_PROFILE: EnemyAttackProfile = {
  attackCooldown: 3,
  resetAttackCooldownOnHit: true,
  hitRecoveryDuration: 3,
  windupDuration: 0.35,
  firstAttackDelay: 1.2,
};

/** @deprecated Utiliser MOTO_ATTACK_PROFILE.attackCooldown */
export const MOTO_SHOOT_INTERVAL = MOTO_ATTACK_PROFILE.attackCooldown;

/** @deprecated Utiliser MOTO_ATTACK_PROFILE.firstAttackDelay */
export const MOTO_SHOOT_FIRST_DELAY = MOTO_ATTACK_PROFILE.firstAttackDelay;

export type EnemyAttackPhase = 'cooldown' | 'windup' | 'idle';

export type EnemyAttackState = {
  phase: EnemyAttackPhase;
  /** Secondes restantes dans la phase courante */
  timer: number;
  /** Serial du dernier impact ayant reset (anti double-callback) */
  lastHitSerial: number;
};

export function createEnemyAttackState(profile: EnemyAttackProfile): EnemyAttackState {
  return {
    phase: 'cooldown',
    timer: profile.firstAttackDelay,
    lastHitSerial: -1,
  };
}

/**
 * Avance le cooldown / windup.
 * `shouldFire` = true uniquement à la fin du windup (tir autorisé).
 * Un projectile déjà tiré n’est pas géré ici.
 */
export function tickEnemyAttack(
  state: EnemyAttackState,
  profile: EnemyAttackProfile,
  dt: number,
): { state: EnemyAttackState; shouldFire: boolean } {
  if (dt <= 0) return { state, shouldFire: false };

  let phase = state.phase;
  let timer = state.timer - dt;
  let shouldFire = false;

  if (phase === 'cooldown' || phase === 'idle') {
    if (timer <= 0) {
      if (profile.windupDuration > 0) {
        phase = 'windup';
        timer = profile.windupDuration;
      } else {
        shouldFire = true;
        phase = 'cooldown';
        timer = profile.attackCooldown;
      }
    } else {
      phase = 'cooldown';
    }
  } else if (phase === 'windup') {
    if (timer <= 0) {
      shouldFire = true;
      phase = 'cooldown';
      timer = profile.attackCooldown;
    }
  }

  return {
    state: { ...state, phase, timer },
    shouldFire,
  };
}

/**
 * Impact offensif réussi du joueur → reset du rythme offensif.
 * Annule un windup en cours. N’affecte pas un projectile déjà tiré.
 * `hitSerial` doit être unique par impact valide (anti multi-callback).
 */
export function onEnemyReceivedPlayerHit(
  state: EnemyAttackState,
  profile: EnemyAttackProfile,
  hitSerial: number,
): { state: EnemyAttackState; cancelledWindup: boolean; didReset: boolean } {
  if (!profile.resetAttackCooldownOnHit) {
    return { state, cancelledWindup: false, didReset: false };
  }
  if (hitSerial === state.lastHitSerial) {
    return { state, cancelledWindup: false, didReset: false };
  }
  const cancelledWindup = state.phase === 'windup';
  return {
    state: {
      phase: 'cooldown',
      timer: profile.hitRecoveryDuration,
      lastHitSerial: hitSerial,
    },
    cancelledWindup,
    didReset: true,
  };
}

/** True si le cooldown est écoulé (prêt à entrer en windup) */
export function enemyCanPrepareAttack(state: EnemyAttackState): boolean {
  return state.phase === 'cooldown' && state.timer <= 0;
}

/**
 * Seuil normalisé |dx| / (enemy.w/2).
 * Au-delà → flanc ; en-deçà → arrière (tolérance anti-flicker).
 */
export const ENEMY_SIDE_RATIO = 0.42;

/**
 * Zones logiques sur l’ennemi (plus petites que le sprite) pour debug / tests.
 * rear = bande centrale basse ; left/right = flancs.
 */
export function enemyZoneRects(enemy: HitRect): {
  rear: HitRect;
  left: HitRect;
  right: HitRect;
} {
  const sideW = enemy.w * 0.3;
  const rearW = enemy.w * 0.36;
  const rearH = enemy.h * 0.55;
  const sideH = enemy.h * 0.7;

  const rear: HitRect = {
    w: rearW,
    h: rearH,
    x: enemy.x,
    y: enemy.bottom - rearH / 2,
    left: enemy.x - rearW / 2,
    right: enemy.x + rearW / 2,
    top: enemy.bottom - rearH,
    bottom: enemy.bottom,
  };

  const left: HitRect = {
    w: sideW,
    h: sideH,
    x: enemy.left + sideW / 2,
    y: enemy.y,
    left: enemy.left,
    right: enemy.left + sideW,
    top: enemy.y - sideH / 2,
    bottom: enemy.y + sideH / 2,
  };

  const right: HitRect = {
    w: sideW,
    h: sideH,
    x: enemy.right - sideW / 2,
    y: enemy.y,
    left: enemy.right - sideW,
    right: enemy.right,
    top: enemy.y - sideH / 2,
    bottom: enemy.y + sideH / 2,
  };

  return { rear, left, right };
}

/**
 * Classifie l’impact joueur ↔ ennemi à partir des hitboxes (centres + overlap).
 * Ne se base pas uniquement sur player.x < enemy.x.
 */
export function classifyEnemyRam(
  player: HitRect,
  enemy: HitRect,
  sideRatio = ENEMY_SIDE_RATIO,
): EnemyRamResult {
  const ox = (Math.max(player.left, enemy.left) + Math.min(player.right, enemy.right)) / 2;
  const oy = (Math.max(player.top, enemy.top) + Math.min(player.bottom, enemy.bottom)) / 2;

  const nx = (ox - enemy.x) / Math.max(1, enemy.w * 0.5);
  const ny = (oy - enemy.y) / Math.max(1, enemy.h * 0.5);

  if (nx <= -sideRatio) return 'side_left';
  if (nx >= sideRatio) return 'side_right';

  if (Math.abs(nx) >= sideRatio * 0.72 && Math.abs(nx) > Math.abs(ny) * 0.55) {
    return nx < 0 ? 'side_left' : 'side_right';
  }

  return 'rear';
}

/** Après un coup latéral : vaincu si hits >= MOTO_SIDE_HITS_TO_DEFEAT */
export function sideHitDefeats(hitsAfter: number): boolean {
  return hitsAfter >= MOTO_SIDE_HITS_TO_DEFEAT;
}
