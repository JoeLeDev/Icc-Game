import type Phaser from 'phaser';
import { CONFIG, getThreatTimeScale, type EquipmentId } from '../config/gameConfig';
import { MOTO_HOLD_Z, MOTO_RAM_IFRAMES, MOTO_ATTACK_PROFILE, MOTO_SIDE_HITS_TO_DEFEAT, classifyEnemyRam, isRammableEnemyKind, sideHitDefeats, onEnemyReceivedPlayerHit } from '../config/enemyRamming';
import { SCORE } from '../config/scoring';
import { audio } from '../utils/AudioManager';
import { Storage } from '../utils/Storage';
import { textureKey } from './AssetFactory';
import { applyWorldDisplayForKey, rememberBaseDisplay } from './SpriteDisplay';
import { DEPTH } from './RoadProjection';
import { intersectsPlayer } from './CollisionDetector';
import type { HitRect } from './Hitbox';
import type { LaneEntity } from './EntityTypes';
import type { EntityManager } from './EntityManager';
import type { WorldView } from './WorldView';
import type { GameFeedback } from './GameFeedback';
import type { MotoAttacks } from './MotoAttacks';

export interface EntityRuntimeHost {
  scrollSpeed: number;
  player: Phaser.GameObjects.Container;
  obstaclesAvoided: number;
  BH: number;
  BW: number;
  world: WorldView;
  doubtsCleared: number;
  runScore: number;
  feedback: GameFeedback;
  time: Phaser.Time.Clock;
  invincibleRemaining: number;
  hasTempShield: boolean;
  lives: number;
  cameras: Phaser.Cameras.Scene2D.CameraManager;
  motoAttacks: MotoAttacks;
  playing: boolean;
  paused: boolean;
  lane: number;
  laneTween: Phaser.Tweens.Tween | null;
  getPlayerHitRect(): HitRect;
  layoutEntity(entity: LaneEntity): void;
  hasEffect(id: string): boolean;
  nearestLane(x: number): number;
  drawHitboxDebug(hit: HitRect): void;
  collectEquipment(id: EquipmentId, x: number, y: number): void;
  collectBonus(id: string, x: number, y: number): void;
  collectLove(x: number, y: number): void;
  refreshHudScore(): void;
  getEntityHitRect(entity: LaneEntity, sprite: Phaser.GameObjects.Image): HitRect;
  snapToPreviousLane(lane?: number): void;
  refreshHearts(): void;
  endGame(won: boolean): void;
}

/** Movement, lifetime, contact resolution and damage; scene owns run presentation. */
export class EntityRuntime {
  constructor(private readonly manager: EntityManager<LaneEntity>, private readonly host: EntityRuntimeHost, private readonly scene: Phaser.Scene) {}
  tick(dt: number): void {
    this.manager.forEachReverse((e, i) => {
      const sp = e.sprite as Phaser.GameObjects.Image;

      if (e.screenSpace) {
        if (e.kind === 'projectile') {
          sp.x += (e.vx ?? 0) * dt;
        }
      } else if (e.fromBehind) {
        e.worldZ += (this.host.scrollSpeed * 0.55 + 70) * dt;
        e.life = (e.life ?? 3) - dt;
        this.host.layoutEntity(e);
      } else if (e.holdAtPlayer && isRammableEnemyKind(e.kind)) {
        // Approche puis reste exactement à la hauteur écran du joueur
        if (e.worldZ > MOTO_HOLD_Z) {
          e.worldZ -= this.host.scrollSpeed * 1.15 * dt;
          if (e.worldZ < MOTO_HOLD_Z) e.worldZ = MOTO_HOLD_Z;
        } else {
          e.worldZ = MOTO_HOLD_Z;
        }
        if (e.ramIFrames && e.ramIFrames > 0) {
          e.ramIFrames = Math.max(0, e.ramIFrames - dt);
        }
        this.host.layoutEntity(e);
        // Verrouille le Y écran sur le joueur (même hauteur visuelle)
        if (e.worldZ <= MOTO_HOLD_Z + 0.5) {
          sp.y = this.host.player.y;
          sp.setDepth(DEPTH.player - 1);
          // Tir périodique comme la calomnie (sorcier)
          this.tickMotoShoot(e, sp, dt);
        }
      } else {
        // Projectiles de voie (calomnie) un peu plus rapides que le scroll
        const mul =
          e.kind === 'projectile' && !e.screenSpace
            ? 1.35 * getThreatTimeScale(this.host.hasEffect('slowmo'))
            : 1;
        e.worldZ -= this.host.scrollSpeed * mul * dt;
        this.host.layoutEntity(e);
      }

      if (e.kind === 'barrel' && e.fuse !== undefined) {
        e.fuse -= dt;
        e.label?.setText(Math.max(0, e.fuse).toFixed(1));
        if (e.fuse <= 0) {
          this.explodeAt(sp.x, sp.y, CONFIG.barrel.blastRadius * (sp.scaleX || 1));
          this.manager.remove(i);
          return;
        }
      }

      if (e.kind === 'colere' && e.fuse !== undefined) {
        e.fuse -= dt;
        if (e.fuse <= 0) {
          e.kind = 'firezone';
          sp.setTint(0xff1744);
          e.fuse = undefined;
          e.life = 2.2;
        }
      }
      if (e.kind === 'firezone') {
        e.life = (e.life ?? 2) - dt;
        if ((e.life ?? 0) <= 0) {
          this.manager.remove(i);
          return;
        }
      }

      if (e.kind === 'peur' && !e.holdAtPlayer && (e.life ?? 0) <= 0) {
        this.manager.remove(i);
        return;
      }
      if (e.fromBehind && (e.life ?? 0) <= 0) {
        this.host.obstaclesAvoided++;
        this.manager.remove(i);
        return;
      }

      // hors champ : z passé + bounds écran (ou z très négatif)
      // Ennemis moto en hold : ne despawnent pas tant qu’ils ne sont pas battus
      if (!e.screenSpace && !(e.holdAtPlayer && isRammableEnemyKind(e.kind))) {
        if (e.worldZ < 0) {
          const b = sp.getBounds();
          const off =
            b.bottom < -56 ||
            b.top > this.host.BH + 56 ||
            b.right < -56 ||
            b.left > this.host.BW + 56;
          if (off || e.worldZ < -160) {
            if (e.kind === 'obstacle' || e.kind === 'depression' || e.kind === 'barrel') {
              this.host.obstaclesAvoided++;
            }
            this.manager.remove(i);
            return;
          }
        } else if (e.worldZ > this.host.world.proj.maxZ + 40) {
          this.manager.remove(i);
          return;
        }
      }
      if (e.screenSpace && (sp.x < -80 || sp.x > this.host.BW + 80 || sp.y > this.host.BH + 80)) {
        this.manager.remove(i);
        return;
      }

      if (e.hit) return;

      // Plus de collision une fois passé le plan joueur (évite hitboxes fantômes)
      if (!e.screenSpace && e.worldZ < 0) return;

      // Collision = AABB écran alignée sur le display (même frame que le contact visuel)
      // A previous contact may have bounced the player to another lane this frame.
      const hit = intersectsPlayer(e, sp, this.host.getPlayerHitRect(), { playerLane: this.host.lane, laneTweenPlaying: this.host.laneTween?.isPlaying() === true, maxZ: this.host.world.proj.maxZ, rammable: isRammableEnemyKind });
      if (hit) this.resolve(e, i);
    });

    this.host.drawHitboxDebug(this.host.getPlayerHitRect());
  }
  resolve(e: LaneEntity, index: number): void {
    if (e.hit) return; // une seule résolution finale par ennemi / entité
    const sp = e.sprite as Phaser.GameObjects.Image;

    if (e.kind === 'equipment' && e.equipmentId) {
      e.hit = true;
      this.host.collectEquipment(e.equipmentId, sp.x, sp.y);
      this.manager.remove(index);
      return;
    }
    if (e.kind === 'bonus' && e.bonusId) {
      e.hit = true;
      this.host.collectBonus(e.bonusId, sp.x, sp.y);
      this.manager.remove(index);
      return;
    }
    if (e.kind === 'love') {
      e.hit = true;
      this.host.collectLove(sp.x, sp.y);
      this.manager.remove(index);
      return;
    }
    if (e.kind === 'doute' || e.isDoubt) {
      e.hit = true;
      this.host.doubtsCleared += 1;
      this.host.runScore += SCORE.perDoubt;
      this.host.refreshHudScore();
      this.host.feedback.toast(`Doute dissipé +${SCORE.perDoubt}`, '#90a4ae');
      audio.ui();
      this.host.feedback.burst(sp.x, sp.y);
      this.manager.remove(index);
      return;
    }

    // Percussion moto : 2 coups latéraux pour vaincre ; arrière = joueur touché
    if (isRammableEnemyKind(e.kind)) {
      if ((e.ramIFrames ?? 0) > 0) return;
      const playerHit = this.host.getPlayerHitRect();
      const enemyHit = this.host.getEntityHitRect(e, sp);
      const ram = classifyEnemyRam(playerHit, enemyHit);
      if (ram === 'side_left' || ram === 'side_right') {
        e.sideHits = (e.sideHits ?? 0) + 1;
        e.ramIFrames = MOTO_RAM_IFRAMES;
        // Reset vrai cooldown offensif (annule windup, repousse de 3 s)
        e.attackHitSerial = (e.attackHitSerial ?? 0) + 1;
        if (e.attackState) {
          const reset = onEnemyReceivedPlayerHit(
            e.attackState,
            MOTO_ATTACK_PROFILE,
            e.attackHitSerial,
          );
          e.attackState = reset.state;
        }
        // Rebond : revenir sur la voie d’avant l’attaque (évite de rester sur la moto)
        this.host.snapToPreviousLane(Math.round(e.lane));
        if (sideHitDefeats(e.sideHits)) {
          e.hit = true;
          this.defeatEnemy(e, index, ram);
          return;
        }
        this.host.feedback.toast(
          `Impact ${e.sideHits}/${MOTO_SIDE_HITS_TO_DEFEAT}`,
          '#ffd54f',
        );
        audio.ui();
        this.host.feedback.burst(sp.x, sp.y);
        sp.setTint(0xffab40);
        this.host.time.delayedCall(180, () => {
          if (sp.active) sp.clearTint();
        });
        return;
      }
      // Un choc arrière ne blesse pas l'ennemi et ne modifie pas son attaque.
      // Les i-frames du joueur évitent plusieurs dégâts pendant le même contact.
      this.takeHit(sp.x, sp.y, Math.round(e.lane));
      return;
    }

    e.hit = true;
    // damage (obstacles, etc.)
    this.takeHit(sp.x, sp.y, Math.round(e.lane));
    this.manager.remove(index);
  }

  private defeatEnemy(e: LaneEntity, index: number, side: 'side_left' | 'side_right'): void {
    const sp = e.sprite as Phaser.GameObjects.Image;
    this.host.obstaclesAvoided++;
    this.host.feedback.toast(side === 'side_left' ? 'Percuté à gauche !' : 'Percuté à droite !', '#69f0ae');
    audio.ui();
    this.host.feedback.burst(sp.x, sp.y);
    this.manager.remove(index);
  }

  takeHit(x: number, y: number, hitLane?: number): void {
    if (this.host.invincibleRemaining > 0) return;
    if (this.host.hasEffect('love')) return;
    if (this.host.hasEffect('boost') && CONFIG.effects.boostProtects) return;

    if (this.host.hasTempShield) {
      this.host.hasTempShield = false;
      this.host.feedback.toast('Bouclier brisé !', '#69f0ae');
      audio.ui();
      this.host.feedback.burst(x, y);
      this.host.invincibleRemaining = 0.5;
      return;
    }

    this.host.lives -= 1;
    this.host.refreshHearts();
    audio.hit();
    this.host.feedback.vibrate(80);
    this.host.feedback.flashScreen(0xff1744, 0.18);
    if (!Storage.getReducedMotion()) this.host.cameras.main.shake(180, 0.01);
    this.host.invincibleRemaining = CONFIG.player.invincibilityDuration;
    this.host.feedback.toast('Touchée !', '#ff5252');
    // Recul sur la voie d’avant le choc — pas sur l’obstacle
    this.host.snapToPreviousLane(hitLane);

    if (this.host.lives <= 0) {
      this.host.endGame(false);
    }
  }
  private explodeAt(x: number, y: number, radius: number): void {
    this.host.feedback.burst(x, y);
    this.host.feedback.flashScreen(0xff6e40, 0.16);
    const lane = this.host.nearestLane(x);
    const fire = this.scene.add.image(0, 0, textureKey('colere', this.scene));
    applyWorldDisplayForKey(fire, 'colere');
    rememberBaseDisplay(fire);
    const ent: LaneEntity = {
      sprite: fire,
      lane,
      worldZ: 18,
      kind: 'firezone',
      hit: false,
      life: 1.5,
      baseScale: 1.25,
      logicalKey: 'colere',
    };
    this.host.layoutEntity(ent);
    this.manager.add(ent);
    if (Math.hypot(x - this.host.player.x, y - this.host.player.y) < radius) {
      this.takeHit(x, y);
    }
  }


  private tickMotoShoot(e: LaneEntity, sp: Phaser.GameObjects.Image, dt: number): void {
    this.host.motoAttacks.tick(e, dt, this.host.playing && !this.host.paused, () => this.fireMotoProjectile(e, sp));
  }

  private fireMotoProjectile(e: LaneEntity, sp: Phaser.GameObjects.Image): void {
    const scaleNow = () => getThreatTimeScale(this.host.hasEffect('slowmo'));
    const targetLane = this.host.lane;
    const toX = this.host.world.proj.laneScreenX(targetLane);
    const toY = this.host.player.y - 8;
    const laneHalf = this.host.world.proj.laneSpacingAt(0) * 0.48;
    this.host.motoAttacks.launch(sp, {
      lane: targetLane, x: toX, y: toY, laneHalf, durationScale: scaleNow(), bottom: this.host.BH + 70,
    }, textureKey('projectile', this.scene), (proj, lane) => {
      this.manager.add({ sprite: proj, lane, worldZ: 0, kind: 'projectile', hit: false, screenSpace: true, logicalKey: 'projectile' });
    });
  }

}
