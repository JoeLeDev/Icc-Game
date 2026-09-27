import type Phaser from 'phaser';
import type { EquipmentId } from '../config/gameConfig';
import type { EnemyAttackState } from '../config/enemyRamming';

export type EntityKind =
  | 'obstacle'
  | 'equipment'
  | 'bonus'
  | 'love'
  | 'depression'
  | 'calomnie'
  | 'projectile'
  | 'colere'
  | 'peur'
  | 'doute'
  | 'reject'
  | 'barrel'
  | 'firezone';

export interface LaneEntity {
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.Container;
  lane: number;
  /** Profondeur logique (0 = plan joueuse, >0 vers l’horizon) */
  worldZ: number;
  kind: EntityKind;
  equipmentId?: EquipmentId;
  bonusId?: string;
  hit: boolean;
  fuse?: number;
  fuseMax?: number;
  label?: Phaser.GameObjects.Text;
  warning?: Phaser.GameObjects.Arc;
  vx?: number;
  fromBehind?: boolean;
  life?: number;
  isDoubt?: boolean;
  /** Projectiles / UI écran : ignorer la projection Z */
  screenSpace?: boolean;
  baseScale?: number;
  /** Clé logique (sans _ext) pour re-normaliser l’affichage */
  logicalKey?: string;
  /** Coups de flanc déjà portés (ennemis moto) */
  sideHits?: number;
  /** Invuln après un coup latéral */
  ramIFrames?: number;
  /** Reste au plan joueur jusqu’à élimination */
  holdAtPlayer?: boolean;
  /** Machine d’attaque (cooldown / windup) — motos & futurs mobs */
  attackState?: EnemyAttackState;
  /** Compteur d’impacts offensifs valides (serial anti double-reset) */
  attackHitSerial?: number;
}
