import Phaser from 'phaser';
import {
  computeLayout,
  readSafeAreaInsets,
  setCurrentLayout,
  type LayoutMetrics,
} from '../config/responsiveLayout';
import {
  AttackFamily,
  BONUSES,
  CONFIG,
  EQUIPMENTS,
  EquipmentId,
  LANES,
  getScrollSpeed,
  getThreatTimeScale,
  getTier,
  isAttackUnlocked,
  nextLaneIndex,
  readDevQuery,
} from '../config/gameConfig';
import { type DifficultyPreset, getDifficultyPreset } from '../config/difficulty';
import {
  MAX_MOTO_FOES,
  MOTO_ATTACK_PROFILE,
  MOTO_HOLD_Z,
  MOTO_RAM_IFRAMES,
  MOTO_SIDE_HITS_TO_DEFEAT,
  classifyEnemyRam,
  createEnemyAttackState,
  isRammableEnemyKind,
  onEnemyReceivedPlayerHit,
  sideHitDefeats,
  tickEnemyAttack,
  type EnemyAttackState,
} from '../config/enemyRamming';
import { SCORE, computeRunScore } from '../config/scoring';
import { horizonFadeAlpha, horizonSpawnZ, LANE_OCCUPANCY } from '../config/laneOccupancy';
import { textureKey } from '../systems/AssetFactory';
import {
  aabbOverlap,
  aabbSweptOverlap,
  hitRectForRole,
  hitRoleForKey,
  type HitRect,
} from '../systems/Hitbox';
import { DEPTH, entityDrawDepth } from '../systems/RoadProjection';
import {
  RoadOccupant,
  pickEquipmentId,
  pickMotoSpawnLanes,
  pickSafeCollectLane,
} from '../systems/SpawnFairness';
import {
  ObstacleLaneDistributor,
  chooseObstacleLanesControlled,
  isObstacleSpawnDebugEnabled,
} from '../config/obstacleSpawn';
import {
  applyHudEquipmentIcon,
  applyPlayerDisplay,
  applyWorldDisplayForKey,
  rememberBaseDisplay,
} from '../systems/SpriteDisplay';
import { WorldView } from '../systems/WorldView';
import { audio } from '../utils/AudioManager';
import { Rng, createRng } from '../utils/Rng';
import { Storage } from '../utils/Storage';

type EntityKind =
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

interface LaneEntity {
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

interface ActiveEffect {
  id: string;
  remaining: number;
}

export class GameScene extends Phaser.Scene {
  private world!: WorldView;
  private player!: Phaser.GameObjects.Container;
  private playerSprite!: Phaser.GameObjects.Image;
  private playerGlow!: Phaser.GameObjects.Arc;
  private loveAura!: Phaser.GameObjects.Arc;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;

  private lane: number = CONFIG.player.startLane;
  /** Voie avant le dernier changement — pour reculer après un choc */
  private previousLane: number = CONFIG.player.startLane;
  private targetX = 0;
  private lives: number = CONFIG.player.maxLives;
  /** Invincibilité restante (secondes de simulation) */
  private invincibleRemaining = 0;
  private hasTempShield = false;

  private collected = new Set<EquipmentId>();
  private loveCollected = false;
  private distance = 0;
  private obstaclesAvoided = 0;
  /** Doutes (?) dissipés — points + note finale */
  private doubtsCleared = 0;
  private runScore = 0;

  private entities: LaneEntity[] = [];
  private effects: ActiveEffect[] = [];

  private scrollSpeed: number = CONFIG.speed.base;
  private difficulty!: DifficultyPreset;
  private obstacleDistributor = new ObstacleLaneDistributor();
  private playing = false;
  private paused = false;
  private countdownActive = false;
  private finalPhase = false;
  private finalTimer = 0;
  private gameOver = false;
  private won = false;

  /** Temps de simulation (s) — n'avance pas en pause */
  private simTime = 0;

  private spawnTimers = {
    obstacle: 3.5,
    equipment: CONFIG.spawn.firstEquipmentDelay,
    bonus: 16,
    attack: 22,
  };
  /** Respiration après attaque (s) — freine obstacle + attaque */
  private breathRemaining = 0;
  private rng!: Rng;
  private debugMode = false;
  private debugText: Phaser.GameObjects.Text | null = null;
  private runSeed: number | null = null;
  private inviRing!: Phaser.GameObjects.Arc;

  private closedLane: number | null = null;
  private closeRemaining = 0;
  private closeWarningRemaining = 0;
  private closeBarrier: Phaser.GameObjects.Image | null = null;
  private closeWarnRect: Phaser.GameObjects.Rectangle | null = null;

  private distractionRemaining = 0;
  private distractionOverlay!: Phaser.GameObjects.Rectangle;

  private hudHearts: Phaser.GameObjects.Image[] = [];
  private hudEqIcons: Phaser.GameObjects.Image[] = [];
  private hudEqText!: Phaser.GameObjects.Text;
  private hudDist!: Phaser.GameObjects.Text;
  private hudEffects!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private flash!: Phaser.GameObjects.Rectangle;
  private countdownText!: Phaser.GameObjects.Text;
  private speedBanner!: Phaser.GameObjects.Text;
  private pauseBtn!: Phaser.GameObjects.Container;
  private pauseBtnHit!: Phaser.GameObjects.Zone;
  private controlsHint!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private pauseMenuHits: Phaser.GameObjects.Rectangle[] = [];
  private hudHits: Phaser.GameObjects.Rectangle[] = [];

  private swipeStartX = 0;
  private laneTween: Phaser.Tweens.Tween | null = null;
  private lastLaneKeyAt = 0;
  private keys: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    esc: Phaser.Input.Keyboard.Key;
  } | null = null;

  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastSpeedTier = -1;
  private hudTopBar!: Phaser.GameObjects.Rectangle;
  private eqPanel!: Phaser.GameObjects.Rectangle;
  private layout!: LayoutMetrics;
  private pauseBg!: Phaser.GameObjects.Rectangle;
  private hitDebugGfx: Phaser.GameObjects.Graphics | null = null;
  private playerHitbox = { w: 42, h: 70 };

  private readonly onFocusCanvas = (): void => {
    this.game.canvas.focus();
  };
  /** Secours fenêtre : Phaser rate parfois les flèches selon le focus / capture */
  private readonly onWindowKeyDown = (e: KeyboardEvent): void => {
    if (!this.sys?.isActive()) return;
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        this.changeLaneFromKey(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        this.changeLaneFromKey(1);
        break;
      case 'Escape':
        e.preventDefault();
        this.togglePause();
        break;
      default:
        break;
    }
  };
  private readonly onPointerDown = (p: Phaser.Input.Pointer): void => {
    const hits = this.input.hitTestPointer(p);
    const onHud = hits.some(
      (obj) => (obj as Phaser.GameObjects.GameObject & { isHudControl?: boolean }).isHudControl,
    );
    this.swipeStartX = onHud ? Number.NaN : p.x;
  };
  private readonly onPointerUp = (p: Phaser.Input.Pointer): void => {
    if (!this.canControl() || Number.isNaN(this.swipeStartX)) return;
    const dx = p.x - this.swipeStartX;
    if (Math.abs(dx) > 40) this.changeLane(dx > 0 ? 1 : -1);
  };
  private readonly onVisibility = (): void => {
    if (document.hidden && !this.paused && (this.playing || this.countdownActive) && !this.gameOver && !this.won) {
      this.setPaused(true);
    }
  };

  constructor() {
    super('Game');
  }

  create(): void {
    const q = readDevQuery();
    this.debugMode = q.debug;
    this.runSeed = q.seed;
    this.rng = createRng(q.seed);
    if (q.seed != null && this.debugMode) {
      console.info(`[Khayil debug] seed=${q.seed}`);
    }

    this.syncLayout();
    this.resetState();
    this.createWorld();
    this.createPlayer();
    this.createHud();
    this.createPauseOverlay();
    this.setupInput();
    this.createParticles();
    if (this.debugMode) this.createDebugOverlay();
    this.startCountdown();
    this.scale.on('resize', this.onGameResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  private get W(): number {
    return this.layout.gameWidth;
  }

  private get H(): number {
    return this.layout.gameHeight;
  }

  private get BW(): number {
    return this.layout.browserWidth;
  }

  private get BH(): number {
    return this.layout.browserHeight;
  }

  private syncLayout(): void {
    this.layout = computeLayout(this.scale.width, this.scale.height, readSafeAreaInsets());
    setCurrentLayout(this.layout);
  }

  private readonly onGameResize = (): void => {
    if (!this.sys?.isActive()) return;
    this.syncLayout();
    this.applyResponsiveLayout();
  };

  /** Recalcule HUD / moto / contrôles / décor sans recréer les GameObjects. */
  private applyResponsiveLayout(): void {
    if (!this.world || !this.player) return;
    this.world.applyLayout(this.layout);

    applyPlayerDisplay(this.playerSprite);
    rememberBaseDisplay(this.playerSprite);
    const pw = this.layout.playerDisplayWidth;
    this.playerShadow.setSize(pw * 0.85, 12);
    this.playerGlow.setRadius(pw * 0.55);
    this.loveAura.setRadius(pw * 0.85);
    this.inviRing.setRadius(pw * 0.72);
    this.refreshPlayerHitbox();
    this.player.y = this.layout.playerY;
    this.targetX = this.world.proj.laneScreenX(this.lane);
    if (!this.laneTween?.isPlaying()) this.player.x = this.targetX;

    this.hudTopBar.setPosition(this.layout.centerX, 0);
    this.hudTopBar.setSize(this.W, this.layout.hudBarHeight);
    this.hudHearts.forEach((h, i) => {
      h.setPosition(this.layout.hudHeartStartX + i * this.layout.hudHeartGap, this.layout.hudHeartY);
      h.setDisplaySize(this.layout.hudHeartSize, this.layout.hudHeartSize);
    });
    this.hudEqText.setPosition(this.layout.centerX, this.layout.hudEqTextY);
    this.hudDist.setPosition(this.layout.hudDistX, this.layout.hudDistY);
    this.hudEffects.setPosition(this.layout.centerX, this.layout.hudEffectsY);
    this.eqPanel.setPosition(this.layout.eqPanelX, this.layout.eqIconStartY + this.layout.eqPanelHeight / 2 - 8);
    this.eqPanel.setSize(this.layout.hudIconSize + 12, this.layout.eqPanelHeight);
    this.hudEqIcons.forEach((icon, i) => {
      icon.setPosition(this.layout.eqPanelX, this.layout.eqIconStartY + i * this.layout.eqIconGap);
      applyHudEquipmentIcon(icon);
    });

    this.placeButton(this.pauseBtn, this.pauseBtnHit, this.layout.pauseBtnX, this.layout.pauseBtnY, this.layout.pauseBtnSize);

    this.distractionOverlay.setPosition(this.BW / 2, this.BH / 2).setSize(this.BW, this.BH);
    this.flash.setPosition(this.BW / 2, this.BH / 2).setSize(this.BW, this.BH);
    this.toast.setPosition(this.layout.centerX, this.layout.playerY - 120);
    this.speedBanner.setPosition(this.layout.centerX, this.H * 0.32);
    this.countdownText.setPosition(this.layout.centerX, this.H * 0.42);
    if (this.controlsHint?.active) {
      this.controlsHint.setPosition(this.layout.centerX, this.H * 0.55);
    }
    if (this.pauseOverlay && this.pauseBg) {
      this.pauseBg.setSize(this.BW, this.BH);
      this.pauseOverlay.setPosition(this.BW / 2, this.BH / 2);
    }

    for (const e of this.entities) {
      if (e.logicalKey && e.sprite instanceof Phaser.GameObjects.Image) {
        e.sprite.setData('baseDisplayW', undefined);
        e.sprite.setData('baseDisplayH', undefined);
        this.layoutEntity(e);
      }
    }
  }

  private placeButton(
    btn: Phaser.GameObjects.Container,
    hit: Phaser.GameObjects.Zone,
    x: number,
    y: number,
    size: number,
  ): void {
    btn.setPosition(x, y);
    const bg = btn.list[0] as Phaser.GameObjects.Arc;
    const txt = btn.list[1] as Phaser.GameObjects.Text;
    if (bg?.setRadius) bg.setRadius(size / 2);
    if (txt?.setFontSize) txt.setFontSize(Math.round(size * 0.45));
    const hitPad = Math.max(96, size + 40);
    hit.setPosition(x, y);
    hit.setSize(hitPad, hitPad);
  }

  private onShutdown(): void {
    this.scale.off('resize', this.onGameResize, this);
    this.cleanupInput();
    this.time.paused = false;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.destroyEntities();
    this.world?.destroy();
    this.laneTween = null;
    this.hudHearts = [];
    this.hudEqIcons = [];
    this.pauseMenuHits = [];
    this.hudHits = [];
    this.closeBarrier = null;
    this.closeWarnRect = null;
  }

  private resetState(): void {
    this.destroyEntities();
    this.world?.destroy();
    this.hudHearts = [];
    this.hudEqIcons = [];
    this.pauseMenuHits = [];
    this.hudHits = [];
    this.closeBarrier = null;
    this.closeWarnRect = null;
    this.laneTween = null;

    this.lane = CONFIG.player.startLane;
    this.previousLane = CONFIG.player.startLane;
    this.lives = CONFIG.player.maxLives;
    this.invincibleRemaining = 0;
    this.hasTempShield = false;
    this.collected.clear();
    this.loveCollected = false;
    this.distance = 0;
    this.obstaclesAvoided = 0;
    this.doubtsCleared = 0;
    this.runScore = 0;
    this.entities = [];
    this.effects = [];
    this.difficulty = getDifficultyPreset(Storage.getDifficulty());
    this.obstacleDistributor.reset();
    this.scrollSpeed = CONFIG.speed.base * this.difficulty.speedMul;
    this.playing = false;
    this.paused = false;
    this.countdownActive = false;
    this.finalPhase = false;
    this.finalTimer = 0;
    this.gameOver = false;
    this.won = false;
    this.simTime = 0;
    this.closedLane = null;
    this.closeRemaining = 0;
    this.closeWarningRemaining = 0;
    this.distractionRemaining = 0;
    this.spawnTimers = {
      obstacle: 3.5 * this.difficulty.obstacleIntervalMul,
      equipment: CONFIG.spawn.firstEquipmentDelay,
      bonus: 16,
      attack: 22 * this.difficulty.attackIntervalMul,
    };
    this.breathRemaining = 0;
    this.lastSpeedTier = -1;
    this.swipeStartX = 0;
    this.time.paused = false;
  }

  private destroyEntities(): void {
    for (const e of this.entities) {
      e.warning?.destroy();
      e.label?.destroy();
      e.sprite?.destroy();
    }
    this.entities = [];
  }

  private createWorld(): void {
    this.world = new WorldView(this);
    this.world.create();
    this.world.setDebug(this.debugMode);
    this.targetX = this.world.proj.laneScreenX(this.lane);

    this.distractionOverlay = this.add
      .rectangle(this.BW / 2, this.BH / 2, this.BW, this.BH, 0x00e5ff, 0)
      .setDepth(DEPTH.fx);
  }

  private createPlayer(): void {
    const y = this.world.proj.playerY;
    const pw = this.layout.playerDisplayWidth;
    this.playerShadow = this.add.ellipse(0, 40, pw * 0.85, 12, 0x000000, 0.45);
    // Halo uniquement pendant le boost (invisible par défaut)
    this.playerGlow = this.add.circle(0, 8, pw * 0.55, 0xff6e40, 0);
    this.loveAura = this.add
      .circle(0, 0, pw * 0.85, 0xff80ab, 0)
      .setStrokeStyle(3, 0xff2d95, 0);
    this.inviRing = this.add
      .circle(0, 4, pw * 0.72, 0x00e5ff, 0)
      .setStrokeStyle(3, 0x00e5ff, 0);
    this.playerSprite = this.add.image(0, 0, textureKey('player', this));
    applyPlayerDisplay(this.playerSprite);
    rememberBaseDisplay(this.playerSprite);
    this.refreshPlayerHitbox();
    this.player = this.add.container(this.targetX, y, [
      this.playerShadow,
      this.playerGlow,
      this.loveAura,
      this.inviRing,
      this.playerSprite,
    ]);
    this.player.setDepth(DEPTH.player);
    this.player.setSize(this.playerHitbox.w, this.playerHitbox.h);

    this.trail = this.add.particles(0, 0, 'particle-pink', {
      speed: { min: 10, max: 40 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.45, end: 0 },
      lifespan: 320,
      frequency: 40,
      follow: this.player,
      followOffset: { x: 0, y: this.playerSprite.displayHeight * 0.35 },
      blendMode: 'ADD',
    });
    this.trail.setDepth(DEPTH.player - 1);
  }

  private createParticles(): void {
    this.particles = this.add.particles(0, 0, 'particle-gold', {
      speed: { min: 40, max: 160 },
      scale: { start: 1.1, end: 0 },
      lifespan: 480,
      emitting: false,
      tint: [0xffd54f, 0xff2d95, 0x00e5ff, 0xffffff],
    });
    this.particles.setDepth(DEPTH.fx);
  }

  private createHud(): void {
    this.hudTopBar = this.add
      .rectangle(this.layout.centerX, 0, this.W, this.layout.hudBarHeight, 0x070412, 0.55)
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hud - 1)
      .setScrollFactor(0);

    for (let i = 0; i < CONFIG.player.maxLives; i++) {
      const h = this.add
        .image(
          this.layout.hudHeartStartX + i * this.layout.hudHeartGap,
          this.layout.hudHeartY,
          'heart',
        )
        .setScrollFactor(0)
        .setDepth(DEPTH.hud)
        .setDisplaySize(this.layout.hudHeartSize, this.layout.hudHeartSize);
      this.hudHearts.push(h);
    }

    this.hudEqText = this.add
      .text(this.layout.centerX, this.layout.hudEqTextY, 'Équipements : 0/7', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '13px',
        color: '#fff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    this.hudDist = this.add
      .text(this.layout.hudDistX, this.layout.hudDistY, '0 M', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '13px',
        color: '#fff',
      })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);

    // Colonne équipements hors chaussée (bas-côté gauche)
    this.eqPanel = this.add
      .rectangle(
        this.layout.eqPanelX,
        this.layout.eqIconStartY + this.layout.eqPanelHeight / 2 - 8,
        this.layout.hudIconSize + 12,
        this.layout.eqPanelHeight,
        0x0a0618,
        0.62,
      )
      .setStrokeStyle(1, 0xffd54f, 0.35)
      .setDepth(DEPTH.hud - 1)
      .setScrollFactor(0);

    EQUIPMENTS.forEach((eq, i) => {
      const iconKey = textureKey(`eq-icon-${eq.id}`, this);
      const icon = this.add
        .image(this.layout.eqPanelX, this.layout.eqIconStartY + i * this.layout.eqIconGap, iconKey)
        .setOrigin(0.5)
        .setAlpha(0.38)
        .setDepth(DEPTH.hud)
        .setScrollFactor(0)
        .setTint(0x8899aa);
      applyHudEquipmentIcon(icon);
      this.hudEqIcons.push(icon);
    });

    this.hudEffects = this.add
      .text(this.layout.centerX, this.layout.hudEffectsY, '', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '11px',
        color: '#00e5ff',
        align: 'center',
        backgroundColor: '#00000066',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    this.toast = this.add
      .text(this.layout.centerX, this.layout.playerY - 120, '', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '16px',
        color: '#ffd54f',
        stroke: '#000',
        strokeThickness: 4,
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(DEPTH.hud + 10);

    this.speedBanner = this.add
      .text(this.layout.centerX, this.H * 0.32, '', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '15px',
        color: '#ff2d95',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(DEPTH.hud + 10);

    this.flash = this.add
      .rectangle(this.BW / 2, this.BH / 2, this.BW, this.BH, 0xffffff, 0)
      .setDepth(DEPTH.fx + 5);

    this.countdownText = this.add
      .text(this.layout.centerX, this.H * 0.42, '', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '96px',
        color: '#ff2d95',
        stroke: '#fff',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 20)
      .setAlpha(0);

    this.pauseBtn = this.makeButton(
      this.layout.pauseBtnX,
      this.layout.pauseBtnY,
      'Ⅱ',
      () => this.togglePause(),
      this.layout.pauseBtnSize,
      0.55,
    );

    this.controlsHint = this.add
      .text(
        this.layout.centerX,
        this.H * 0.55,
        'Ordinateur : ← → ou A / D\nMobile : swiper gauche / droite',
        {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '15px',
          color: '#e1bee7',
          align: 'center',
          lineSpacing: 6,
          stroke: '#000',
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 21)
      .setAlpha(0);

    this.input.setTopOnly(false);
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    cb: () => void,
    size = 40,
    alpha = 0.55,
  ): Phaser.GameObjects.Container {
    const hitPad = Math.max(96, size + 40);
    const bg = this.add.circle(0, 0, size / 2, 0x1a0a30, alpha).setStrokeStyle(2, 0xff2d95, 0.9);
    const txt = this.add
      .text(0, 0, label, { fontFamily: 'Outfit', fontSize: `${Math.round(size * 0.45)}px`, color: '#fff' })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [bg, txt]).setDepth(DEPTH.hud + 40).setScrollFactor(0);

    const hit = this.add.zone(x, y, hitPad, hitPad).setScrollFactor(0).setDepth(DEPTH.hud + 50);
    hit.setInteractive({ useHandCursor: true });
    if (hit.input) {
      (hit.input as Phaser.Types.Input.InteractiveObject & { alwaysEnabled?: boolean }).alwaysEnabled = true;
    }
    (hit as Phaser.GameObjects.Zone & { isHudControl?: boolean }).isHudControl = true;
    this.hudHits.push(hit as unknown as Phaser.GameObjects.Rectangle);
    this.pauseBtnHit = hit;

    const press = () => {
      bg.setFillStyle(0x9b59ff, 0.95);
      this.time.delayedCall(120, () => {
        if (bg.active) bg.setFillStyle(0x1a0a30, alpha);
      });
      if (this.gameOver || this.won) return;
      audio.ui();
      cb();
    };

    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.swipeStartX = Number.NaN;
      pointer.event?.preventDefault?.();
      press();
    });

    return c;
  }

  private createPauseOverlay(): void {
    this.pauseMenuHits = [];
    this.pauseBg = this.add.rectangle(0, 0, this.BW, this.BH, 0x070412, 0.82);
    const title = this.add
      .text(0, -160, 'PAUSE', {
        fontFamily: 'Orbitron',
        fontSize: '36px',
        color: '#ff2d95',
      })
      .setOrigin(0.5);

    const resume = this.makeMenuBtn(0, -40, 'REPRENDRE', () => this.togglePause());
    const restart = this.makeMenuBtn(0, 30, 'RECOMMENCER', () => {
      this.scene.restart();
    });
    const home = this.makeMenuBtn(0, 100, 'ACCUEIL', () => {
      this.scene.start('Menu');
    });

    this.pauseOverlay = this.add.container(this.BW / 2, this.BH / 2, [
      this.pauseBg,
      title,
      resume,
      restart,
      home,
    ]);
    this.pauseOverlay.setDepth(200).setVisible(false);
    this.setPauseMenuInteractive(false);
  }

  private makeMenuBtn(x: number, y: number, label: string, cb: () => void): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, 220, 48, 0x2a1050, 1).setStrokeStyle(2, 0xff2d95);
    const txt = this.add
      .text(0, 0, label, { fontFamily: 'Outfit', fontSize: '16px', color: '#fff', fontStyle: 'bold' })
      .setOrigin(0.5);
    bg.on('pointerdown', () => {
      audio.ui();
      cb();
    });
    this.pauseMenuHits.push(bg);
    return this.add.container(x, y, [bg, txt]);
  }

  private setPauseMenuInteractive(on: boolean): void {
    for (const hit of this.pauseMenuHits) {
      if (on) hit.setInteractive({ useHandCursor: true });
      else hit.disableInteractive();
    }
  }

  private setupInput(): void {
    const canvas = this.game.canvas;
    canvas.setAttribute('tabindex', '0');
    canvas.style.outline = 'none';
    canvas.focus();
    this.input.on('pointerdown', this.onFocusCanvas);

    const kb = this.input.keyboard;
    if (kb) {
      kb.enabled = true;
      kb.addCapture([
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
        Phaser.Input.Keyboard.KeyCodes.A,
        Phaser.Input.Keyboard.KeyCodes.D,
        Phaser.Input.Keyboard.KeyCodes.ESC,
      ]);

      this.keys = {
        left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false),
        right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false),
        a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
        d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
        esc: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false),
      };
    }

    window.addEventListener('keydown', this.onWindowKeyDown, { passive: false });
    this.input.on('pointerdown', this.onPointerDown);
    this.input.on('pointerup', this.onPointerUp);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private cleanupInput(): void {
    const kb = this.input.keyboard;
    if (kb && this.keys) {
      kb.removeCapture([
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
        Phaser.Input.Keyboard.KeyCodes.A,
        Phaser.Input.Keyboard.KeyCodes.D,
        Phaser.Input.Keyboard.KeyCodes.ESC,
      ]);
      kb.removeKey(this.keys.left);
      kb.removeKey(this.keys.right);
      kb.removeKey(this.keys.a);
      kb.removeKey(this.keys.d);
      kb.removeKey(this.keys.esc);
      this.keys = null;
    }
    window.removeEventListener('keydown', this.onWindowKeyDown);
    this.input.off('pointerdown', this.onFocusCanvas);
    this.input.off('pointerdown', this.onPointerDown);
    this.input.off('pointerup', this.onPointerUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private pollKeyboard(): void {
    if (!this.keys) return;
    const { left, right, a, d, esc } = this.keys;
    if (Phaser.Input.Keyboard.JustDown(esc)) {
      this.togglePause();
      return;
    }
    if (!this.canControl()) return;
    if (Phaser.Input.Keyboard.JustDown(left) || Phaser.Input.Keyboard.JustDown(a)) {
      this.changeLaneFromKey(-1);
    } else if (Phaser.Input.Keyboard.JustDown(right) || Phaser.Input.Keyboard.JustDown(d)) {
      this.changeLaneFromKey(1);
    }
  }

  private canControl(): boolean {
    return this.playing && !this.paused && !this.gameOver && !this.won;
  }

  /** Évite un double changement de voie (JustDown + listener window la même frame) */
  private changeLaneFromKey(dir: number): void {
    const now = performance.now();
    if (now - this.lastLaneKeyAt < 80) return;
    this.lastLaneKeyAt = now;
    this.changeLane(dir);
  }

  private changeLane(dir: number): void {
    if (!this.canControl()) return;
    const closed = this.closedLane !== null && this.closeRemaining > 0 ? this.closedLane : null;
    const next = nextLaneIndex(this.lane, dir, closed, LANES);
    if (next === this.lane) return;

    this.previousLane = this.lane;
    this.lane = next;
    this.targetX = this.world.proj.laneScreenX(this.lane);

    // Un seul tween à la fois — évite les courses lors d'entrées rapides
    if (this.laneTween) {
      this.laneTween.stop();
      this.laneTween = null;
    }
    this.tweens.killTweensOf(this.player);
    this.playerSprite.setAngle(dir * -14);
    this.laneTween = this.tweens.add({
      targets: this.player,
      x: this.targetX,
      duration: CONFIG.player.laneSwitchDuration * 1000,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.laneTween = null;
        this.player.x = this.targetX;
        this.tweens.add({ targets: this.playerSprite, angle: 0, duration: 140, ease: 'Sine.easeOut' });
      },
    });
  }

  private startCountdown(): void {
    this.countdownActive = true;
    this.controlsHint.setAlpha(1);
    const steps = ['3', '2', '1', 'GO !'];
    let i = 0;
    const tick = () => {
      if (this.gameOver || this.won) return;
      if (i >= steps.length) {
        this.countdownText.setAlpha(0);
        this.tweens.add({
          targets: this.controlsHint,
          alpha: 0,
          duration: 500,
          onComplete: () => this.controlsHint.setVisible(false),
        });
        this.countdownActive = false;
        this.playing = true;
        this.invincibleRemaining = CONFIG.player.startInvincibility;
        return;
      }
      this.countdownText.setText(steps[i]).setAlpha(1).setScale(1.4);
      if (steps[i] === 'GO !') audio.go();
      else audio.countdown();
      this.tweens.add({
        targets: this.countdownText,
        scale: 1,
        alpha: i === steps.length - 1 ? 0 : 0.85,
        duration: 700,
      });
      i++;
      this.time.delayedCall(750, tick);
    };
    tick();
  }

  update(_t: number, delta: number): void {
    this.pollKeyboard();

    if (this.gameOver || this.won) return;
    if (this.paused) return;

    if (!this.playing) {
      this.world.update(delta / 1000, 70, false);
      return;
    }

    const dt = delta / 1000;
    this.simTime += dt;

    if (this.invincibleRemaining > 0) this.invincibleRemaining = Math.max(0, this.invincibleRemaining - dt);
    if (this.distractionRemaining > 0) this.distractionRemaining = Math.max(0, this.distractionRemaining - dt);

    const eqCount = this.collected.size;
    const boost = this.hasEffect('boost');
    const slowmo = this.hasEffect('slowmo');
    this.scrollSpeed = getScrollSpeed(eqCount, boost, slowmo, this.difficulty);

    const tier = getTier(eqCount);
    if (tier !== this.lastSpeedTier && tier >= 3 && !this.finalPhase) {
      this.showSpeedBanner(tier);
    }
    this.lastSpeedTier = tier;

    this.world.update(dt, this.scrollSpeed, boost);
    this.distance += (this.scrollSpeed * dt) / CONFIG.scoring.distancePerMeter;
    this.refreshHudScore();
    this.player.y = this.world.proj.playerY;

    if (this.breathRemaining > 0) this.breathRemaining = Math.max(0, this.breathRemaining - dt);

    this.tickEffects(dt);
    this.tickSpawns(dt);
    this.tickEntities(dt);
    this.tickLaneClosure(dt);
    this.tickDistraction();
    this.tickInvincibility();
    this.tickMagnet(dt);
    this.tickLoveDestroy();
    this.tickFinalPhase(dt);
    this.updateHudEffects();
    this.updateDebugOverlay();
  }

  private scrollRoad(_amount: number): void {
    /* remplacé par WorldView.update */
  }

  private layoutEntity(e: LaneEntity): void {
    if (e.screenSpace) return;
    const sp = e.sprite as Phaser.GameObjects.Image;
    const p =
      e.worldZ < 0
        ? this.world.proj.projectPast(e.lane, e.worldZ)
        : this.world.proj.project(e.lane, e.worldZ);
    const base = e.baseScale ?? 1;
    const logical = e.logicalKey ?? sp.texture.key.replace(/_ext$/, '');
    if (sp.getData('baseDisplayW') == null) {
      applyWorldDisplayForKey(sp, logical);
      rememberBaseDisplay(sp);
    }
    const bw = sp.getData('baseDisplayW') as number;
    const bh = sp.getData('baseDisplayH') as number;
    sp.setPosition(p.x, p.y);
    sp.setDisplaySize(bw * p.scale * base, bh * p.scale * base);
    sp.setDepth(entityDrawDepth(Math.max(0, e.worldZ), this.world.proj.maxZ));

    // Apparition progressive depuis l’horizon (évite le pop milieu de route)
    const fade = horizonFadeAlpha(e.worldZ, this.world.proj.maxZ);
    if (!e.hit) sp.setAlpha(fade);

    if (e.warning) {
      e.warning.setPosition(p.x, p.y);
      e.warning.setScale(p.scale);
      e.warning.setDepth(sp.depth - 1);
      e.warning.setAlpha((0.1 + Math.sin(this.simTime * 10) * 0.08) * fade);
    }
    if (e.label) {
      e.label.setPosition(p.x, p.y - 28 * p.scale);
      e.label.setScale(Math.max(0.6, p.scale));
      e.label.setDepth(sp.depth + 1);
      e.label.setAlpha(fade);
    }
  }

  private spawnZ(): number {
    // Toujours près du point de fuite — jamais au milieu de la route
    return horizonSpawnZ(this.world.proj.maxZ);
  }

  private hasEffect(id: string): boolean {
    return this.effects.some((e) => e.id === id && e.remaining > 0);
  }

  private addEffect(id: string, duration: number): void {
    if (duration <= 0) return;
    const existing = this.effects.find((e) => e.id === id);
    if (existing && CONFIG.effects.refreshOnPickup) {
      existing.remaining = duration;
    } else if (!existing) {
      this.effects.push({ id, remaining: duration });
    }
  }

  private tickEffects(dt: number): void {
    for (const e of this.effects) e.remaining -= dt;
    this.effects = this.effects.filter((e) => e.remaining > 0);

    // love aura
    const love = this.hasEffect('love');
    this.loveAura.setFillStyle(0xff80ab, love ? 0.22 : 0);
    this.loveAura.setStrokeStyle(3, 0xff2d95, love ? 0.9 : 0);
    if (love) this.loveAura.rotation += dt * 1.5;

    // boost glow — visible seulement pendant le boost
    const boost = this.hasEffect('boost');
    this.playerGlow.setFillStyle(0xff6e40, boost ? 0.35 : 0);
  }

  private updateHudEffects(): void {
    const parts: string[] = [];
    for (const e of this.effects) {
      const labels: Record<string, string> = {
        magnet: 'Aimant',
        slowmo: 'Ralenti',
        boost: 'Boost',
        love: 'Amour',
      };
      if (labels[e.id]) parts.push(`${labels[e.id]} ${Math.ceil(e.remaining)}s`);
    }
    if (this.hasTempShield) parts.push('Bouclier');
    if (this.invincibleRemaining > 0.15 && !this.hasEffect('love')) {
      parts.push(`Invuln. ${this.invincibleRemaining.toFixed(1)}s`);
    }
    this.hudEffects.setText(parts.join(' · '));
  }

  private tickSpawns(dt: number): void {
    if (this.finalPhase && this.finalTimer < 2.5) return;

    const tier = getTier(this.collected.size);
    const breathSlow = this.breathRemaining > 0 ? 0.45 : 1;

    this.spawnTimers.obstacle -= dt * breathSlow;
    this.spawnTimers.equipment -= dt;
    this.spawnTimers.bonus -= dt;
    this.spawnTimers.attack -= dt * breathSlow;

    if (this.spawnTimers.obstacle <= 0) {
      this.spawnObstaclePattern(tier);
      this.spawnTimers.obstacle =
        CONFIG.spawn.obstacleInterval[tier]! *
        this.difficulty.obstacleIntervalMul *
        this.rng.float(0.9, 1.12);
    }
    if (this.spawnTimers.equipment <= 0 && this.collected.size < 7) {
      this.spawnEquipment();
      this.spawnTimers.equipment =
        CONFIG.spawn.equipmentInterval[tier]! * this.rng.float(0.92, 1.12);
    }
    if (this.spawnTimers.bonus <= 0) {
      this.spawnBonusOrLove();
      this.spawnTimers.bonus = CONFIG.spawn.bonusInterval[tier]! * this.rng.float(0.9, 1.2);
    }
    if (this.spawnTimers.attack <= 0 && CONFIG.spawn.attackInterval[tier]! < 90) {
      if (this.spawnAttack(tier)) {
        this.breathRemaining = Math.max(this.breathRemaining, CONFIG.spawn.breathAfterAttack);
      }
      this.spawnTimers.attack =
        CONFIG.spawn.attackInterval[tier]! *
        this.difficulty.attackIntervalMul *
        this.rng.float(0.9, 1.15);
    }
  }

  private currentOccupants(): RoadOccupant[] {
    return this.entities
      .filter((e) => !e.screenSpace)
      .map((e) => ({
        lane: Math.round(e.lane),
        z: e.worldZ,
        role:
          e.kind === 'equipment' || e.kind === 'bonus' || e.kind === 'love' || e.kind === 'doute'
            ? ('collect' as const)
            : ('danger' as const),
        fromBehind: e.fromBehind,
      }));
  }

  private activeClosedLane(): number | null {
    return this.closedLane !== null && this.closeRemaining > 0 ? this.closedLane : null;
  }

  /** Garantit toujours au moins une voie libre (filtre simple) */
  private freeLanes(blocked: number[]): number[] {
    const closed = this.activeClosedLane();
    return [0, 1, 2].filter((l) => !blocked.includes(l) && l !== closed);
  }

  private motoFoeLanes(): number[] {
    return this.entities
      .filter((e) => isRammableEnemyKind(e.kind) && !e.hit)
      .map((e) => Math.round(e.lane));
  }

  private countMotoFoes(): number {
    return this.entities.filter((e) => isRammableEnemyKind(e.kind) && !e.hit).length;
  }

  private laneBusyNear(lane: number, z: number, gap: number = CONFIG.spawn.minGapFront): boolean {
    return this.entities.some((e) => !e.screenSpace && e.lane === lane && Math.abs(e.worldZ - z) < gap);
  }

  private spawnObstaclePattern(tier: number): void {
    const z = this.spawnZ();
    const decision = chooseObstacleLanesControlled({
      tier,
      playerLane: this.lane,
      closedLane: this.activeClosedLane(),
      existing: this.currentOccupants(),
      spawnZ: z,
      scrollSpeed: this.scrollSpeed,
      rng: this.rng,
      distributor: this.obstacleDistributor,
      doubleBlockMul: this.difficulty.doubleBlockMul,
      minGap: CONFIG.spawn.minGapFront,
      debug: this.debugMode || isObstacleSpawnDebugEnabled(),
    });
    if (!decision) return;

    let spawned = 0;
    for (const lane of decision.lanes) {
      // Double-check spatial (déjà validé, mais évite race avec autres spawns)
      if (this.laneBusyNear(lane, z)) continue;
      let kind = 'car';
      const r = this.rng.next();
      if (tier >= 5 && r < 0.22) kind = 'barrel';
      else if (tier >= 3 && r < 0.18) kind = 'truck';
      else if (r < 0.35) kind = this.rng.pick(['barrier', 'cone', 'hole']);
      this.spawnObstacle(lane, z, kind);
      spawned++;
    }

    if (spawned >= 2) {
      this.breathRemaining = Math.max(this.breathRemaining, CONFIG.spawn.breathAfterAttack);
      this.spawnTimers.attack = Math.max(
        this.spawnTimers.attack,
        CONFIG.spawn.attackDelayAfterDouble,
      );
    }
  }

  private spawnObstacle(lane: number, z: number, kind = 'car'): void {
    let key = 'car';
    let entKind: EntityKind = 'obstacle';
    let baseScale = 1;
    if (kind === 'truck') key = 'truck';
    else if (kind === 'barrier') key = 'barrier';
    else if (kind === 'cone') key = 'cone';
    else if (kind === 'hole') key = 'hole';
    else if (kind === 'barrel') {
      key = 'barrel';
      entKind = 'barrel';
    }

    const sprite = this.add.image(0, 0, textureKey(key, this));
    applyWorldDisplayForKey(sprite, key);
    rememberBaseDisplay(sprite);
    const ent: LaneEntity = {
      sprite,
      lane,
      worldZ: z,
      kind: entKind,
      hit: false,
      baseScale,
      logicalKey: key,
    };
    if (entKind === 'barrel') {
      ent.fuse = CONFIG.barrel.fuseDuration;
      ent.fuseMax = CONFIG.barrel.fuseDuration;
      ent.warning = this.add
        .circle(0, 0, CONFIG.barrel.blastRadius, 0xff1744, 0.12)
        .setStrokeStyle(2, 0xffeb3b, 0.7);
      ent.label = this.add
        .text(0, 0, `${ent.fuse!.toFixed(1)}`, {
          fontFamily: 'Orbitron',
          fontSize: '12px',
          color: '#ffeb3b',
        })
        .setOrigin(0.5);
    }
    this.layoutEntity(ent);
    this.entities.push(ent);
  }

  private spawnEquipment(): void {
    const id = pickEquipmentId(this.collected, this.rng);
    if (!id) return;

    const z = this.spawnZ();
    const lane = pickSafeCollectLane({
      playerLane: this.lane,
      closedLane: this.activeClosedLane(),
      existing: this.currentOccupants(),
      bandZ: z,
      scrollSpeed: this.scrollSpeed,
      switchDuration: CONFIG.player.laneSwitchDuration,
      reactionTime: CONFIG.spawn.reactionTime,
      safetyBand: CONFIG.spawn.safetyBand,
      rng: this.rng,
    });
    if (lane === null) return;
    if (this.laneBusyNear(lane, z, 110)) return;

    const sprite = this.add.image(0, 0, textureKey(`eq-${id}`, this));
    applyWorldDisplayForKey(sprite, `eq-${id}`);
    rememberBaseDisplay(sprite);
    const ent: LaneEntity = { sprite, lane, worldZ: z, kind: 'equipment', equipmentId: id, hit: false, logicalKey: `eq-${id}` };
    this.layoutEntity(ent);
    this.entities.push(ent);
  }

  private spawnBonusOrLove(): void {
    const z = this.spawnZ();
    const lane = pickSafeCollectLane({
      playerLane: this.lane,
      closedLane: this.activeClosedLane(),
      existing: this.currentOccupants(),
      bandZ: z,
      scrollSpeed: this.scrollSpeed,
      switchDuration: CONFIG.player.laneSwitchDuration,
      reactionTime: CONFIG.spawn.reactionTime,
      safetyBand: CONFIG.spawn.safetyBand,
      rng: this.rng,
    });
    if (lane === null) return;
    if (this.laneBusyNear(lane, z, 110)) return;

    if (this.rng.chance(CONFIG.spawn.loveChance) && !this.hasEffect('love')) {
      const sprite = this.add.image(0, 0, textureKey('love', this));
      applyWorldDisplayForKey(sprite, 'love');
      rememberBaseDisplay(sprite);
      const ent: LaneEntity = { sprite, lane, worldZ: z, kind: 'love', hit: false, logicalKey: 'love' };
      this.layoutEntity(ent);
      this.entities.push(ent);
      return;
    }

    let bonus = this.rng.pick([...BONUSES]);
    if (bonus.id === 'life' && this.lives >= CONFIG.player.maxLives) {
      bonus = this.rng.pick(BONUSES.filter((b) => b.id !== 'life'));
    }
    if (bonus.id === 'boost' && this.hasEffect('slowmo')) {
      bonus = this.rng.pick(BONUSES.filter((b) => b.id !== 'boost'));
    }
    const logicalBonus = `bonus-${bonus.id}`;
    const sprite = this.add.image(0, 0, textureKey(logicalBonus, this));
    applyWorldDisplayForKey(sprite, logicalBonus);
    rememberBaseDisplay(sprite);
    const ent: LaneEntity = { sprite, lane, worldZ: z, kind: 'bonus', bonusId: bonus.id, hit: false, logicalKey: logicalBonus };
    this.layoutEntity(ent);
    this.entities.push(ent);
  }

  /** @returns true si une attaque a été lancée */
  private spawnAttack(tier: number): boolean {
    const elapsed = this.simTime;
    const unlocked: AttackFamily[] = (Object.keys(CONFIG.attackUnlock) as AttackFamily[]).filter((f) =>
      isAttackUnlocked(f, tier, elapsed),
    );
    if (!unlocked.length) return false;

    const motoSlots = MAX_MOTO_FOES - this.countMotoFoes();
    const motoPool = (['depression', 'peur'] as const).filter(
      (f) => unlocked.includes(f) && motoSlots > 0,
    );

    // Priorité ennemis moto (~60 % si disponibles)
    if (motoPool.length && this.rng.chance(0.6)) {
      const kind = this.rng.pick([...motoPool]);
      if (kind === 'depression') this.spawnDepression();
      else this.spawnPeur();
      return true;
    }

    if (unlocked.includes('fromBehind') && this.rng.chance(0.12)) {
      this.spawnFromBehind();
      return true;
    }

    const pool = unlocked.filter((f) => f !== 'fromBehind');
    if (!pool.length) return false;
    const type = this.rng.pick(pool);

    switch (type) {
      case 'depression':
        if (this.countMotoFoes() >= MAX_MOTO_FOES) return false;
        this.spawnDepression();
        break;
      case 'calomnie':
        this.spawnCalomnie();
        break;
      case 'colere':
        this.spawnColere();
        break;
      case 'peur':
        if (this.countMotoFoes() >= MAX_MOTO_FOES) return false;
        this.spawnPeur();
        break;
      case 'doute':
        this.spawnDoute();
        break;
      case 'reject':
        this.spawnReject();
        break;
      case 'distraction':
        this.triggerDistraction();
        break;
      default:
        return false;
    }
    return true;
  }

  private showDirectionalWarn(
    x: number,
    y: number,
    label: string,
    color: string,
    side?: 'left' | 'right' | 'behind',
  ): void {
    const markers: Phaser.GameObjects.GameObject[] = [];
    const t = this.add
      .text(x, y, label, {
        fontFamily: 'Orbitron',
        fontSize: '14px',
        color,
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx + 2);
    markers.push(t);
    if (side === 'left') {
      markers.push(
        this.add
          .triangle(this.layout.gameOffsetX + 28, y, 0, 10, 18, 0, 18, 20, 0xea80fc, 0.9)
          .setDepth(DEPTH.fx + 2),
      );
    } else if (side === 'right') {
      markers.push(
        this.add
          .triangle(this.layout.gameOffsetX + this.W - 28, y, 18, 10, 0, 0, 0, 20, 0xea80fc, 0.9)
          .setDepth(DEPTH.fx + 2),
      );
    } else if (side === 'behind') {
      markers.push(
        this.add
          .triangle(x, this.BH - 100, 10, 0, 0, 16, 20, 16, 0xff5252, 0.95)
          .setDepth(DEPTH.fx + 2),
      );
    }
    this.tweens.add({
      targets: markers,
      alpha: 0,
      duration: 1000,
      onComplete: () => markers.forEach((m) => m.destroy()),
    });
  }

  private spawnDepression(): void {
    this.spawnMotoFoes('depression', 'DÉPRESSION', '#ce93d8');
  }

  /** 1 ou 2 ennemis moto (jamais 3). Restent au niveau joueur jusqu’à 2 coups latéraux. */
  private spawnMotoFoes(
    kind: 'depression' | 'peur',
    label: string,
    color: string,
  ): void {
    const slots = MAX_MOTO_FOES - this.countMotoFoes();
    if (slots <= 0) return;

    // Si le couloir est déjà chargé (2 voies dangereuses), 1 moto max
    const nearBlocked = this.currentOccupants().filter(
      (o) => o.role === 'danger' && o.z <= CONFIG.spawn.motoClearanceZ,
    );
    const nearLaneCount = new Set(nearBlocked.map((o) => o.lane)).size;
    const desired =
      slots >= 2 && nearLaneCount < 2 && this.rng.chance(0.5) ? 2 : 1;

    const z = this.spawnZ();
    const lanes = pickMotoSpawnLanes(
      this.lane,
      this.activeClosedLane(),
      this.currentOccupants(),
      desired,
      this.rng,
    );
    if (!lanes.length) return;

    for (const lane of lanes) {
      if (this.laneBusyNear(lane, z, 120)) continue;
      const sprite = this.add.image(0, 0, textureKey(kind === 'peur' ? 'peur' : 'depression', this));
      if (kind === 'depression') sprite.setAlpha(0.95);
      applyWorldDisplayForKey(sprite, kind);
      rememberBaseDisplay(sprite);
      const ent: LaneEntity = {
        sprite,
        lane,
        worldZ: z,
        kind,
        hit: false,
        logicalKey: kind,
        sideHits: 0,
        ramIFrames: 0,
        holdAtPlayer: true,
        attackState: createEnemyAttackState(MOTO_ATTACK_PROFILE),
        attackHitSerial: 0,
      };
      this.layoutEntity(ent);
      const p = this.world.proj.project(lane, Math.min(z, 160));
      this.showDirectionalWarn(p.x, p.y, label, color);
      this.entities.push(ent);
    }
  }

  private spawnCalomnie(): void {
    const fromLeft = this.rng.chance(0.5);
    const y = this.H * this.rng.float(0.38, 0.52);
    const left = this.layout.gameOffsetX;
    const right = this.layout.gameOffsetX + this.W;
    const sx = fromLeft ? left - 30 : right + 30;
    const attacker = this.add.image(sx, y, textureKey('calomnie', this)).setDepth(DEPTH.fx);
    applyWorldDisplayForKey(attacker, 'calomnie');
    this.showDirectionalWarn(
      fromLeft ? left + 56 : right - 56,
      y,
      'CALOMNIE',
      '#ea80fc',
      fromLeft ? 'left' : 'right',
    );
    const scaleNow = () => getThreatTimeScale(this.hasEffect('slowmo'));
    this.tweens.add({
      targets: attacker,
      x: fromLeft ? left + 36 : right - 36,
      duration: 500 / scaleNow(),
      onComplete: () => {
        // 3 tirs : chacun choisit une voie et y vole depuis la calomnie
        for (let i = 0; i < 3; i++) {
          this.time.delayedCall((i * 380) / scaleNow(), () => {
            if (!this.playing || this.paused || !attacker.active) return;
            this.fireCalomnieShot(attacker.x, attacker.y);
          });
        }
        this.time.delayedCall(1600 / scaleNow(), () => {
          this.tweens.add({
            targets: attacker,
            x: fromLeft ? left - 40 : right + 40,
            duration: 400,
            onComplete: () => attacker.destroy(),
          });
        });
      },
    });
  }

  /**
   * Projectile calomnie : part du sorcier, vole jusqu’à une voie choisie.
   * Dangereux seulement près de cette voie (pas de traverse des 3 voies).
   */
  private fireCalomnieShot(fromX: number, fromY: number): void {
    const targetLane = this.rng.int(0, 2);
    const scale = getThreatTimeScale(this.hasEffect('slowmo'));
    const toX = this.world.proj.laneScreenX(targetLane);
    const toY = this.player.y - 12;
    const laneHalf = this.world.proj.laneSpacingAt(0) * 0.48;

    const proj = this.add
      .image(fromX, fromY, textureKey('projectile', this))
      .setDepth(DEPTH.fx);
    applyWorldDisplayForKey(proj, 'projectile');
    proj.setData('armed', false);

    this.entities.push({
      sprite: proj,
      lane: targetLane,
      worldZ: 0,
      kind: 'projectile',
      hit: false,
      screenSpace: true,
      logicalKey: 'projectile',
    });

    this.showDirectionalWarn(toX, Math.min(toY - 80, this.H * 0.4), '!', '#ea80fc');

    // Vol vers la voie (~1,1 s) → temps d’esquiver
    this.tweens.add({
      targets: proj,
      x: toX,
      y: toY,
      duration: 1100 / scale,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        if (!proj.active) return;
        proj.setData('armed', Math.abs(proj.x - toX) <= laneHalf);
      },
      onComplete: () => {
        if (!proj.active) return;
        proj.setData('armed', true);
        // Continue vers le bas et sort de l’écran
        this.tweens.add({
          targets: proj,
          y: this.BH + 70,
          duration: 480 / scale,
          ease: 'Quad.easeIn',
        });
      },
    });
  }

  private spawnColere(): void {
    const free = this.freeLanes(this.motoFoeLanes());
    if (!free.length) return;
    const z = this.spawnZ();
    const dangerLane = free.includes(this.lane)
      ? this.rng.chance(0.55)
        ? this.lane
        : this.rng.pick(free)
      : this.rng.pick(free);
    const sprite = this.add.image(0, 0, textureKey('colere', this));
    applyWorldDisplayForKey(sprite, 'colere');
    rememberBaseDisplay(sprite);
    const ent: LaneEntity = {
      sprite,
      lane: dangerLane,
      worldZ: z,
      kind: 'colere',
      hit: false,
      fuse: 2.2,
      fuseMax: 2.2,
      logicalKey: 'colere',
    };
    this.layoutEntity(ent);
    const p = this.world.proj.project(dangerLane, Math.min(z, 150));
    this.showDirectionalWarn(p.x, p.y, 'COLÈRE', '#ff6e40');
    this.entities.push(ent);
  }

  private spawnPeur(): void {
    this.spawnMotoFoes('peur', 'PEUR', '#ffeb3b');
  }

  private spawnDoute(): void {
    const z = this.spawnZ();
    const lane = pickSafeCollectLane({
      playerLane: this.lane,
      closedLane: this.activeClosedLane(),
      existing: this.currentOccupants(),
      bandZ: z,
      scrollSpeed: this.scrollSpeed,
      switchDuration: CONFIG.player.laneSwitchDuration,
      reactionTime: CONFIG.spawn.reactionTime,
      safetyBand: CONFIG.spawn.safetyBand,
      rng: this.rng,
    });
    if (lane === null) return;
    const sprite = this.add.image(0, 0, textureKey('doute', this)).setAlpha(0.85);
    applyWorldDisplayForKey(sprite, 'doute');
    rememberBaseDisplay(sprite);
    const ent: LaneEntity = { sprite, lane, worldZ: z, kind: 'doute', hit: false, isDoubt: true, logicalKey: 'doute' };
    this.layoutEntity(ent);
    this.entities.push(ent);
  }

  private spawnReject(): void {
    if (this.closedLane !== null) return;
    const candidates = [0, 1, 2].filter((l) => l !== this.lane);
    const lane: number = this.rng.pick(candidates.length ? candidates : [0, 2]);
    this.closedLane = lane;
    this.closeWarningRemaining = CONFIG.laneClosure.warningDuration;
    this.closeRemaining = CONFIG.laneClosure.warningDuration + CONFIG.laneClosure.duration;

    this.closeWarnRect?.destroy();
    const laneHalf = this.world.proj.laneSpacingAt(0) * 0.9;
    this.closeWarnRect = this.add
      .rectangle(
        this.world.proj.laneScreenX(lane),
        (this.world.proj.horizonY + this.H) / 2,
        laneHalf,
        this.H * 0.55,
        0xff1744,
        0.15,
      )
      .setDepth(DEPTH.entityBase + 5)
      .setStrokeStyle(2, 0xff1744, 0.8);
    this.showDirectionalWarn(this.world.proj.laneScreenX(lane), this.H * 0.45, 'REJET', '#ff1744');
    this.tweens.add({ targets: this.closeWarnRect, alpha: 0.05, duration: 300, yoyo: true, repeat: 3 });

    this.time.delayedCall(CONFIG.laneClosure.warningDuration * 1000, () => {
      if (!this.scene.isActive('Game')) return;
      this.closeWarnRect?.destroy();
      this.closeWarnRect = null;
      this.closeBarrier?.destroy();
      this.closeBarrier = this.add.image(0, 0, textureKey('reject', this)).setDepth(DEPTH.entityBase + 20);
      applyWorldDisplayForKey(this.closeBarrier, 'reject');
      rememberBaseDisplay(this.closeBarrier);
      const p = this.world.proj.project(lane, 70);
      const bw = this.closeBarrier.getData('baseDisplayW') as number;
      const bh = this.closeBarrier.getData('baseDisplayH') as number;
      this.closeBarrier.setPosition(p.x, p.y);
      this.closeBarrier.setDisplaySize(bw * p.scale * 1.15, bh * p.scale * 1.15);
      if (this.lane === lane) this.changeLane(lane === 0 ? 1 : -1);
    });
  }

  private spawnFromBehind(): void {
    const free = this.freeLanes([]);
    if (!free.length) return;
    const away = free.filter((l) => l !== this.lane);
    const lane = this.rng.pick(away.length ? away : free);
    const sprite = this.add.image(0, 0, textureKey('car', this)).setTint(0xff5252);
    applyWorldDisplayForKey(sprite, 'car');
    rememberBaseDisplay(sprite);
    const ent: LaneEntity = {
      sprite,
      lane,
      worldZ: -35,
      kind: 'obstacle',
      hit: false,
      fromBehind: true,
      life: 3.5,
      logicalKey: 'car',
    };
    this.layoutEntity(ent);
    this.entities.push(ent);
    this.showDirectionalWarn(this.world.proj.laneScreenX(lane), this.H - 120, 'ARRIÈRE', '#ff5252', 'behind');
  }

  private triggerDistraction(): void {
    this.distractionRemaining = CONFIG.distraction.duration;
    this.showToast('DISTRACTION', '#00e5ff');
    this.distractionOverlay.setFillStyle(0x00e5ff, 0.08);
  }

  private tickDistraction(): void {
    if (this.distractionRemaining > 0) {
      this.cameras.main.setAngle(Math.sin(this.simTime * 12) * 0.6);
      this.distractionOverlay.setAlpha(0.06 + Math.sin(this.simTime * 10) * 0.04);
    } else {
      this.cameras.main.setAngle(0);
      this.distractionOverlay.setAlpha(0);
    }
  }

  private tickLaneClosure(dt: number): void {
    if (this.closedLane === null) return;
    this.closeRemaining = Math.max(0, this.closeRemaining - dt);
    this.closeWarningRemaining = Math.max(0, this.closeWarningRemaining - dt);
    if (this.closeBarrier && this.closedLane !== null) {
      const p = this.world.proj.project(this.closedLane, 70);
      const bw = (this.closeBarrier.getData('baseDisplayW') as number) || this.closeBarrier.displayWidth;
      const bh = (this.closeBarrier.getData('baseDisplayH') as number) || this.closeBarrier.displayHeight;
      this.closeBarrier.setPosition(p.x, p.y);
      this.closeBarrier.setDisplaySize(bw * p.scale * 1.15, bh * p.scale * 1.15);
    }
    if (this.closeRemaining <= 0) {
      this.closedLane = null;
      this.closeBarrier?.destroy();
      this.closeBarrier = null;
      this.closeWarnRect?.destroy();
      this.closeWarnRect = null;
    }
  }

  private tickEntities(dt: number): void {
    const playerHit = this.getPlayerHitRect();

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      const sp = e.sprite as Phaser.GameObjects.Image;

      if (e.screenSpace) {
        if (e.kind === 'projectile') {
          sp.x += (e.vx ?? 0) * dt;
        }
      } else if (e.fromBehind) {
        e.worldZ += (this.scrollSpeed * 0.55 + 70) * dt;
        e.life = (e.life ?? 3) - dt;
        this.layoutEntity(e);
      } else if (e.holdAtPlayer && isRammableEnemyKind(e.kind)) {
        // Approche puis reste exactement à la hauteur écran du joueur
        if (e.worldZ > MOTO_HOLD_Z) {
          e.worldZ -= this.scrollSpeed * 1.15 * dt;
          if (e.worldZ < MOTO_HOLD_Z) e.worldZ = MOTO_HOLD_Z;
        } else {
          e.worldZ = MOTO_HOLD_Z;
        }
        if (e.ramIFrames && e.ramIFrames > 0) {
          e.ramIFrames = Math.max(0, e.ramIFrames - dt);
        }
        this.layoutEntity(e);
        // Verrouille le Y écran sur le joueur (même hauteur visuelle)
        if (e.worldZ <= MOTO_HOLD_Z + 0.5) {
          sp.y = this.player.y;
          sp.setDepth(DEPTH.player - 1);
          // Tir périodique comme la calomnie (sorcier)
          this.tickMotoShoot(e, sp, dt);
        }
      } else {
        // Projectiles de voie (calomnie) un peu plus rapides que le scroll
        const mul =
          e.kind === 'projectile' && !e.screenSpace
            ? 1.35 * getThreatTimeScale(this.hasEffect('slowmo'))
            : 1;
        e.worldZ -= this.scrollSpeed * mul * dt;
        this.layoutEntity(e);
      }

      if (e.kind === 'barrel' && e.fuse !== undefined) {
        e.fuse -= dt;
        e.label?.setText(Math.max(0, e.fuse).toFixed(1));
        if (e.fuse <= 0) {
          this.explodeAt(sp.x, sp.y, CONFIG.barrel.blastRadius * (sp.scaleX || 1));
          this.destroyEntity(i);
          continue;
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
          this.destroyEntity(i);
          continue;
        }
      }

      if (e.kind === 'peur' && !e.holdAtPlayer && (e.life ?? 0) <= 0) {
        this.destroyEntity(i);
        continue;
      }
      if (e.fromBehind && (e.life ?? 0) <= 0) {
        this.obstaclesAvoided++;
        this.destroyEntity(i);
        continue;
      }

      // hors champ : z passé + bounds écran (ou z très négatif)
      // Ennemis moto en hold : ne despawnent pas tant qu’ils ne sont pas battus
      if (!e.screenSpace && !(e.holdAtPlayer && isRammableEnemyKind(e.kind))) {
        if (e.worldZ < 0) {
          const b = sp.getBounds();
          const off =
            b.bottom < -56 ||
            b.top > this.BH + 56 ||
            b.right < -56 ||
            b.left > this.BW + 56;
          if (off || e.worldZ < -160) {
            if (e.kind === 'obstacle' || e.kind === 'depression' || e.kind === 'barrel') {
              this.obstaclesAvoided++;
            }
            this.destroyEntity(i);
            continue;
          }
        } else if (e.worldZ > this.world.proj.maxZ + 40) {
          this.destroyEntity(i);
          continue;
        }
      }
      if (e.screenSpace && (sp.x < -80 || sp.x > this.BW + 80 || sp.y > this.BH + 80)) {
        this.destroyEntity(i);
        continue;
      }

      if (e.hit) continue;

      // Plus de collision une fois passé le plan joueur (évite hitboxes fantômes)
      if (!e.screenSpace && e.worldZ < 0) continue;

      // Collision = AABB écran alignée sur le display (même frame que le contact visuel)
      const hit = this.checkEntityHit(e, sp, playerHit);
      if (hit) this.handlePickupOrHit(e, i);
    }

    this.drawHitboxDebug(playerHit);
  }

  /** Hitbox moto dérivée du displaySize (marges transparentes compensées). */
  private refreshPlayerHitbox(): void {
    const dw = this.playerSprite.displayWidth;
    const dh = this.playerSprite.displayHeight;
    const rect = hitRectForRole(0, 0, dw, dh, 'player');
    this.playerHitbox = { w: rect.w, h: rect.h };
    this.player?.setSize(rect.w, rect.h);
  }

  private getPlayerHitRect(): HitRect {
    return hitRectForRole(
      this.player.x,
      this.player.y,
      this.playerSprite.displayWidth,
      this.playerSprite.displayHeight,
      'player',
    );
  }

  private getEntityHitRect(e: LaneEntity, sp: Phaser.GameObjects.Image): HitRect {
    const key = e.logicalKey ?? sp.texture.key;
    const role = hitRoleForKey(key);
    return hitRectForRole(sp.x, sp.y, sp.displayWidth, sp.displayHeight, role);
  }

  /**
   * Contact visuel → pickup dans la même frame.
   * Swept AABB si l’entité a bougé depuis la frame précédente (anti-tunneling).
   */
  private checkEntityHit(
    e: LaneEntity,
    sp: Phaser.GameObjects.Image,
    playerHit: HitRect,
  ): boolean {
    const to = this.getEntityHitRect(e, sp);

    if (e.screenSpace) {
      // Projectiles de voie (calomnie / moto) : uniquement sur la voie ciblée, une fois armés
      if (e.kind === 'projectile') {
        if (Math.round(e.lane) !== this.lane) {
          sp.setData('prevHitX', sp.x);
          sp.setData('prevHitY', sp.y);
          return false;
        }
        if (sp.getData('armed') === false) {
          sp.setData('prevHitX', sp.x);
          sp.setData('prevHitY', sp.y);
          return false;
        }
      }
      const prevX = sp.getData('prevHitX') as number | undefined;
      const prevY = sp.getData('prevHitY') as number | undefined;
      let hit: boolean;
      if (prevX != null && prevY != null) {
        const from = hitRectForRole(prevX, prevY, sp.displayWidth, sp.displayHeight, 'projectile');
        hit = aabbSweptOverlap(playerHit, from, to);
      } else {
        hit = aabbOverlap(playerHit, to);
      }
      sp.setData('prevHitX', sp.x);
      sp.setData('prevHitY', sp.y);
      return hit;
    }

    const laneOk =
      Math.round(e.lane) === this.lane ||
      (isRammableEnemyKind(e.kind) && Math.abs(Math.round(e.lane) - this.lane) <= 1) ||
      (this.laneTween?.isPlaying() === true && Math.abs(Math.round(e.lane) - this.lane) <= 1);
    if (!laneOk) {
      sp.setData('prevHitX', sp.x);
      sp.setData('prevHitY', sp.y);
      return false;
    }

    if (e.worldZ > this.world.proj.maxZ * 0.55) {
      sp.setData('prevHitX', sp.x);
      sp.setData('prevHitY', sp.y);
      return false;
    }

    const role = hitRoleForKey(e.logicalKey ?? sp.texture.key);
    const prevX = sp.getData('prevHitX') as number | undefined;
    const prevY = sp.getData('prevHitY') as number | undefined;
    let hit: boolean;
    if (prevX != null && prevY != null) {
      const from = hitRectForRole(prevX, prevY, sp.displayWidth, sp.displayHeight, role);
      hit = aabbSweptOverlap(playerHit, from, to);
    } else {
      hit = aabbOverlap(playerHit, to);
    }
    sp.setData('prevHitX', sp.x);
    sp.setData('prevHitY', sp.y);
    return hit;
  }

  private drawHitboxDebug(playerHit: HitRect): void {
    if (!this.debugMode) return;
    if (!this.hitDebugGfx) {
      this.hitDebugGfx = this.add.graphics().setDepth(DEPTH.hud + 90);
    }
    const g = this.hitDebugGfx;
    g.clear();
    g.lineStyle(1, 0x00ff88, 0.9);
    g.strokeRect(playerHit.left, playerHit.top, playerHit.w, playerHit.h);
    for (const e of this.entities) {
      if (e.hit || e.screenSpace) continue;
      const sp = e.sprite as Phaser.GameObjects.Image;
      if (!sp.active) continue;
      const r = this.getEntityHitRect(e, sp);
      const collectible =
        e.kind === 'equipment' || e.kind === 'bonus' || e.kind === 'love';
      g.lineStyle(1, collectible ? 0xffd54f : 0xff1744, 0.85);
      g.strokeRect(r.left, r.top, r.w, r.h);
    }
  }

  private destroyEntity(index: number): void {
    const e = this.entities[index];
    e.warning?.destroy();
    e.label?.destroy();
    e.sprite.destroy();
    this.entities.splice(index, 1);
  }

  private handlePickupOrHit(e: LaneEntity, index: number): void {
    if (e.hit) return; // une seule résolution finale par ennemi / entité
    const sp = e.sprite as Phaser.GameObjects.Image;

    if (e.kind === 'equipment' && e.equipmentId) {
      e.hit = true;
      this.collectEquipment(e.equipmentId, sp.x, sp.y);
      this.destroyEntity(index);
      return;
    }
    if (e.kind === 'bonus' && e.bonusId) {
      e.hit = true;
      this.collectBonus(e.bonusId, sp.x, sp.y);
      this.destroyEntity(index);
      return;
    }
    if (e.kind === 'love') {
      e.hit = true;
      this.collectLove(sp.x, sp.y);
      this.destroyEntity(index);
      return;
    }
    if (e.kind === 'doute' || e.isDoubt) {
      e.hit = true;
      this.doubtsCleared += 1;
      this.runScore += SCORE.perDoubt;
      this.refreshHudScore();
      this.showToast(`Doute dissipé +${SCORE.perDoubt}`, '#90a4ae');
      audio.ui();
      this.burst(sp.x, sp.y, 0x90a4ae);
      this.destroyEntity(index);
      return;
    }

    // Percussion moto : 2 coups latéraux pour vaincre ; arrière = joueur touché
    if (isRammableEnemyKind(e.kind)) {
      if ((e.ramIFrames ?? 0) > 0) return;
      const playerHit = this.getPlayerHitRect();
      const enemyHit = this.getEntityHitRect(e, sp);
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
        this.snapToPreviousLane(Math.round(e.lane));
        if (sideHitDefeats(e.sideHits)) {
          e.hit = true;
          this.defeatEnemy(e, index, ram);
          return;
        }
        this.showToast(
          `Impact ${e.sideHits}/${MOTO_SIDE_HITS_TO_DEFEAT}`,
          '#ffd54f',
        );
        audio.ui();
        this.burst(sp.x, sp.y, 0xffd54f);
        sp.setTint(0xffab40);
        this.time.delayedCall(180, () => {
          if (sp.active) sp.clearTint();
        });
        return;
      }
      // rear → dégâts joueur
      e.hit = true;
      this.takeHit(sp.x, sp.y, Math.round(e.lane));
      this.destroyEntity(index);
      return;
    }

    e.hit = true;
    // damage (obstacles, etc.)
    this.takeHit(sp.x, sp.y, Math.round(e.lane));
    this.destroyEntity(index);
  }

  private defeatEnemy(e: LaneEntity, index: number, side: 'side_left' | 'side_right'): void {
    const sp = e.sprite as Phaser.GameObjects.Image;
    this.obstaclesAvoided++;
    this.showToast(side === 'side_left' ? 'Percuté à gauche !' : 'Percuté à droite !', '#69f0ae');
    audio.ui();
    this.burst(sp.x, sp.y, 0x69f0ae);
    this.destroyEntity(index);
  }

  private collectEquipment(id: EquipmentId, x: number, y: number): void {
    const eq = EQUIPMENTS.find((e) => e.id === id)!;
    const isNew = !this.collected.has(id);
    if (isNew) {
      this.collected.add(id);
      const idx = EQUIPMENTS.findIndex((e) => e.id === id);
      this.hudEqIcons[idx].setAlpha(1).clearTint();
      applyHudEquipmentIcon(this.hudEqIcons[idx]);
      const icon = this.hudEqIcons[idx];
      const sx = icon.scaleX;
      const sy = icon.scaleY;
      this.tweens.add({
        targets: icon,
        scaleX: sx * 1.18,
        scaleY: sy * 1.18,
        duration: 220,
        yoyo: true,
        onComplete: () => applyHudEquipmentIcon(icon),
      });
      this.hudEqText.setText(`Équipements : ${this.collected.size}/7`);
    }
    audio.collect();
    this.vibrate(40);
    this.burst(x, y, eq.color);
    this.flashScreen(eq.color, 0.14);
    this.showToast(isNew ? eq.name : `${eq.short} (déjà équipée)`, '#ffd54f');

    if (isNew && this.collected.size === 7) {
      this.startFinalPhase();
    }
  }

  private collectBonus(id: string, x: number, y: number): void {
    audio.bonus();
    this.burst(x, y, 0x00e5ff);
    const def = BONUSES.find((b) => b.id === id);
    this.showToast(def?.name ?? id, '#00e5ff');

    switch (id) {
      case 'magnet':
        this.addEffect('magnet', CONFIG.effects.magnetRadius && def ? def.duration : 6);
        break;
      case 'shield':
        this.hasTempShield = true;
        break;
      case 'life':
        this.lives = Math.min(CONFIG.player.maxLives, this.lives + 1);
        this.refreshHearts();
        break;
      case 'slowmo':
        this.addEffect('slowmo', def?.duration ?? 5);
        break;
      case 'boost':
        this.addEffect('boost', def?.duration ?? 4);
        break;
    }
  }

  private collectLove(x: number, y: number): void {
    this.loveCollected = true;
    audio.love();
    this.vibrate(60);
    this.addEffect('love', CONFIG.effects.loveDuration);
    this.burst(x, y, 0xff2d95);
    this.flashScreen(0xff80ab, 0.2);
    this.showToast("AMOUR — aucune attaque ne peut te toucher !", '#ff80ab');
    // wave
    const wave = this.add.circle(this.player.x, this.player.y, 20, 0xff80ab, 0.3).setDepth(25);
    this.tweens.add({
      targets: wave,
      radius: 200,
      alpha: 0,
      duration: 600,
      onComplete: () => wave.destroy(),
    });
  }

  private takeHit(x: number, y: number, hitLane?: number): void {
    if (this.invincibleRemaining > 0) return;
    if (this.hasEffect('love')) return;
    if (this.hasEffect('boost') && CONFIG.effects.boostProtects) return;

    if (this.hasTempShield) {
      this.hasTempShield = false;
      this.showToast('Bouclier brisé !', '#69f0ae');
      audio.ui();
      this.burst(x, y, 0x69f0ae);
      this.invincibleRemaining = 0.5;
      return;
    }

    this.lives -= 1;
    this.refreshHearts();
    audio.hit();
    this.vibrate(80);
    this.flashScreen(0xff1744, 0.18);
    this.cameras.main.shake(180, 0.01);
    this.invincibleRemaining = CONFIG.player.invincibilityDuration;
    this.showToast('Touchée !', '#ff5252');
    // Recul sur la voie d’avant le choc — pas sur l’obstacle
    this.snapToPreviousLane(hitLane);

    if (this.lives <= 0) {
      this.endGame(false);
    }
  }

  /**
   * Revient sur la voie précédente (avant le dernier changement).
   * Utilisé au choc (obstacle) ET après une attaque latérale sur moto ennemie.
   * Évite la voie de l’obstacle/ennemi / voie fermée pour ne pas enchaîner les hits.
   */
  private snapToPreviousLane(avoidLane?: number): void {
    const closed = this.activeClosedLane();
    let target = this.previousLane;

    const blocked = (l: number) =>
      l === avoidLane || (closed !== null && l === closed);

    if (blocked(target) || target === this.lane) {
      // Première voie libre adjacente / disponible
      const candidates = [this.previousLane, this.lane - 1, this.lane + 1, 0, 1, 2].filter(
        (l, i, arr) => l >= 0 && l < LANES && arr.indexOf(l) === i,
      );
      target = candidates.find((l) => !blocked(l)) ?? this.lane;
    }

    if (this.laneTween) {
      this.laneTween.stop();
      this.laneTween = null;
    }
    this.tweens.killTweensOf(this.player);
    this.previousLane = this.lane;
    this.lane = target;
    this.targetX = this.world.proj.laneScreenX(target);
    this.player.x = this.targetX;
    this.playerSprite.setAngle(0);
  }

  private tickInvincibility(): void {
    if (this.invincibleRemaining > 0) {
      const pulse = 0.4 + Math.sin(this.simTime * 18) * 0.35;
      this.playerSprite.setAlpha(pulse);
      this.inviRing.setStrokeStyle(3, 0x00e5ff, 0.55 + Math.sin(this.simTime * 14) * 0.35);
      this.inviRing.setFillStyle(0x00e5ff, 0.08);
      this.inviRing.setScale(1 + Math.sin(this.simTime * 10) * 0.06);
    } else {
      this.playerSprite.setAlpha(1);
      this.inviRing.setStrokeStyle(3, 0x00e5ff, 0);
      this.inviRing.setFillStyle(0x00e5ff, 0);
      this.inviRing.setScale(1);
    }
  }

  private createDebugOverlay(): void {
    this.debugText = this.add
      .text(this.layout.gameOffsetX + 8, this.BH - 88, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#69f0ae',
        backgroundColor: '#00000099',
        padding: { x: 4, y: 3 },
      })
      .setDepth(DEPTH.hud + 80)
      .setScrollFactor(0);
  }

  private updateDebugOverlay(): void {
    if (!this.debugMode || !this.debugText) return;
    const tier = getTier(this.collected.size);
    const nearest = this.entities
      .filter((e) => !e.screenSpace && e.worldZ > -20)
      .sort((a, b) => a.worldZ - b.worldZ)[0];
    let nearestLine = 'enti: none';
    if (nearest) {
      const sp = nearest.sprite as Phaser.GameObjects.Image;
      const laneW = this.world.proj.laneSpacingAt(Math.max(0, nearest.worldZ));
      const occ = (sp.getData('laneOccupancy') as number) ?? 0;
      const p =
        nearest.worldZ < 0
          ? this.world.proj.projectPast(nearest.lane, nearest.worldZ)
          : this.world.proj.project(nearest.lane, nearest.worldZ);
      nearestLine = [
        `z=${nearest.worldZ.toFixed(0)} y=${sp.y.toFixed(0)} sc=${p.scale.toFixed(2)}`,
        `laneW=${laneW.toFixed(0)} dw=${sp.displayWidth.toFixed(0)} occ=${occ.toFixed(2)}`,
        `kind=${nearest.kind} fade=${horizonFadeAlpha(nearest.worldZ, this.world.proj.maxZ).toFixed(2)}`,
      ].join(' | ');
    }
    this.debugText.setText(
      [
        `DBG seed=${this.runSeed ?? 'rand'} t=${this.simTime.toFixed(1)}s hitboxes ON`,
        `diff=${this.difficulty.id} tier=${tier} spd=${this.scrollSpeed.toFixed(0)} eq=${this.collected.size}/7`,
        `lane=${this.lane} hit=${this.playerHitbox.w.toFixed(0)}x${this.playerHitbox.h.toFixed(0)} motoOcc=${LANE_OCCUPANCY.motorcycle}`,
        `pw=${this.layout.playerDisplayWidth.toFixed(0)}/${this.layout.laneWidthNear.toFixed(0)}`,
        `game=${this.W}x${this.H} enti=${this.entities.length}`,
        nearestLine,
      ].join('\n'),
    );
  }


  private tickMagnet(dt: number): void {
    if (!this.hasEffect('magnet')) return;
    const pull = CONFIG.effects.magnetPull * dt;
    for (const e of this.entities) {
      if (e.kind !== 'equipment' && e.kind !== 'bonus' && e.kind !== 'love') continue;
      if (e.screenSpace) continue;
      // attire en profondeur et vers la voie du joueur
      if (e.worldZ > 15) e.worldZ = Math.max(15, e.worldZ - pull * 0.35);
      if (e.lane !== this.lane && Math.random() < dt * 3) {
        e.lane += e.lane < this.lane ? 1 : -1;
      }
      this.layoutEntity(e);
    }
  }

  private tickLoveDestroy(): void {
    if (!this.hasEffect('love')) return;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.kind === 'equipment' || e.kind === 'bonus' || e.kind === 'love' || e.kind === 'doute') continue;
      if (e.screenSpace) {
        const sp = e.sprite as Phaser.GameObjects.Image;
        if (Math.hypot(sp.x - this.player.x, sp.y - this.player.y) < CONFIG.effects.loveDestroyRadius) {
          this.burst(sp.x, sp.y, 0xff80ab);
          this.destroyEntity(i);
        }
        continue;
      }
      if (e.worldZ < 90 && Math.abs(e.lane - this.lane) <= 1) {
        this.burst((e.sprite as Phaser.GameObjects.Image).x, (e.sprite as Phaser.GameObjects.Image).y, 0xff80ab);
        this.destroyEntity(i);
      }
    }
  }

  private explodeAt(x: number, y: number, radius: number): void {
    this.burst(x, y, 0xff3d00);
    this.flashScreen(0xff6e40, 0.16);
    const lane = this.nearestLane(x);
    const fire = this.add.image(0, 0, textureKey('colere', this));
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
    this.layoutEntity(ent);
    this.entities.push(ent);
    if (Math.hypot(x - this.player.x, y - this.player.y) < radius) {
      this.takeHit(x, y);
    }
  }

  private nearestLane(x: number): number {
    let best = 0;
    let d = Infinity;
    for (let i = 0; i < LANES; i++) {
      const lx = this.world.proj.laneScreenX(i);
      const dd = Math.abs(lx - x);
      if (dd < d) {
        d = dd;
        best = i;
      }
    }
    return best;
  }

  private startFinalPhase(): void {
    this.finalPhase = true;
    this.finalTimer = CONFIG.speed.finalPhaseDuration;
    this.showToast('CONQUÊTE FINALE !', '#ff2d95');
    this.showSpeedBanner(7);
  }

  private tickFinalPhase(dt: number): void {
    if (!this.finalPhase) return;
    this.finalTimer -= dt;
    this.cameras.main.setAngle(Math.sin(this.simTime * 10) * 0.3);
    if (this.finalTimer <= 0) {
      this.endGame(true);
    }
  }

  private endGame(won: boolean): void {
    this.playing = false;
    this.countdownActive = false;
    this.won = won;
    this.gameOver = !won;
    this.time.paused = false;
    this.paused = false;
    this.pauseOverlay?.setVisible(false);
    this.setPauseMenuInteractive(false);
    this.cameras.main.setAngle(0);

    const scored = computeRunScore({
      distance: this.distance,
      doubts: this.doubtsCleared,
      avoided: this.obstaclesAvoided,
      equipment: this.collected.size,
      love: this.loveCollected,
      won,
    });
    this.runScore = scored.total;

    Storage.addScore({
      distance: Math.floor(this.distance),
      equipment: this.collected.size,
      love: this.loveCollected,
      score: scored.total,
      grade: scored.grade,
      date: new Date().toISOString(),
    });

    if (won) audio.win();
    else audio.lose();

    const payload = {
      won,
      equipment: this.collected.size,
      collected: [...this.collected],
      love: this.loveCollected,
      distance: Math.floor(this.distance),
      avoided: this.obstaclesAvoided,
      doubts: this.doubtsCleared,
      score: scored.total,
      grade: scored.grade,
      gradeLabel: scored.gradeLabel,
    };

    this.time.delayedCall(600, () => {
      this.scene.start(won ? 'Victory' : 'GameOver', payload);
    });
  }

  private refreshHudScore(): void {
    const live = computeRunScore({
      distance: this.distance,
      doubts: this.doubtsCleared,
      avoided: this.obstaclesAvoided,
      equipment: this.collected.size,
      love: this.loveCollected,
      won: false,
    });
    this.runScore = live.total;
    this.hudDist.setText(`${Math.floor(this.distance)} M · ${live.total} pts`);
  }

  /**
   * Tir périodique des motos ennemies au hold — même type de projectile que la calomnie.
   */
  /**
   * Tir périodique des motos ennemies au hold.
   * Cooldown 3 s ; reset complet sur impact latéral joueur (voir onEnemyReceivedPlayerHit).
   */
  private tickMotoShoot(e: LaneEntity, sp: Phaser.GameObjects.Image, dt: number): void {
    if (!this.playing || this.paused || e.hit) return;
    if (!e.attackState) {
      e.attackState = createEnemyAttackState(MOTO_ATTACK_PROFILE);
    }
    const stepped = tickEnemyAttack(e.attackState, MOTO_ATTACK_PROFILE, dt);
    e.attackState = stepped.state;
    if (!stepped.shouldFire) return;
    // Tir : le projectile déjà créé n’est plus lié au cooldown
    this.fireMotoProjectile(e, sp);
  }

  private fireMotoProjectile(e: LaneEntity, sp: Phaser.GameObjects.Image): void {
    const scaleNow = () => getThreatTimeScale(this.hasEffect('slowmo'));
    const targetLane = this.lane;
    const fromX = sp.x;
    const fromY = sp.y - 18;
    const toX = this.world.proj.laneScreenX(targetLane);
    const toY = this.player.y - 8;
    const laneHalf = this.world.proj.laneSpacingAt(0) * 0.48;
    const proj = this.add.image(fromX, fromY, textureKey('projectile', this)).setDepth(DEPTH.fx);
    applyWorldDisplayForKey(proj, 'projectile');
    proj.setData('armed', false);
    this.entities.push({
      sprite: proj,
      lane: targetLane,
      worldZ: 0,
      kind: 'projectile',
      hit: false,
      screenSpace: true,
      logicalKey: 'projectile',
    });
    this.tweens.add({
      targets: proj,
      x: toX,
      y: toY,
      duration: 900 / scaleNow(),
      onUpdate: () => {
        if (!proj.active) return;
        proj.setData('armed', Math.abs(proj.x - toX) <= laneHalf);
      },
      onComplete: () => {
        if (!proj.active) return;
        proj.setData('armed', true);
        this.tweens.add({
          targets: proj,
          y: this.BH + 70,
          duration: 400 / scaleNow(),
        });
      },
    });
  }

  private refreshHearts(): void {
    this.hudHearts.forEach((h, i) => {
      h.setTexture(i < this.lives ? 'heart' : 'heart-empty');
      h.setDisplaySize(this.layout.hudHeartSize, this.layout.hudHeartSize);
    });
  }

  private showToast(msg: string, color = '#ffd54f'): void {
    const baseY = this.layout.playerY - 120;
    this.toast.setText(msg).setColor(color).setAlpha(1).setScale(1.1);
    this.toast.setPosition(this.layout.centerX, baseY);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({
      targets: this.toast,
      alpha: 0,
      y: baseY - 20,
      duration: 1400,
      delay: 400,
      onComplete: () => {
        this.toast.y = baseY;
      },
    });
  }

  private showSpeedBanner(tier: number): void {
    this.speedBanner.setText(`VITESSE AUGMENTÉE — ${this.collected.size}/7`).setAlpha(1);
    this.tweens.add({
      targets: this.speedBanner,
      alpha: 0,
      duration: 1600,
      delay: 800,
    });
    // subtle blur feel via camera fade
    this.cameras.main.flash(200, 255, 45, 149, false, undefined, this);
  }

  private flashScreen(color: number, alpha: number): void {
    this.flash.setFillStyle(color, 1);
    this.flash.setAlpha(Math.min(0.2, alpha));
    this.tweens.killTweensOf(this.flash);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 220 });
  }

  private burst(x: number, y: number, _tint: number): void {
    this.particles.emitParticleAt(x, y, 18);
  }

  private vibrate(ms: number): void {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* ignore */
    }
  }

  private togglePause(): void {
    if (this.gameOver || this.won) return;
    if (!this.playing && !this.countdownActive && !this.paused) return;
    this.setPaused(!this.paused);
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    // Ignorer si la scène n'est plus active (shutdown / transition)
    if (!this.sys?.isActive()) return;
    this.paused = paused;
    this.pauseOverlay?.setVisible(paused);
    this.pauseOverlay?.setActive(paused);
    this.setPauseMenuInteractive(paused);
    this.setLaneButtonsEnabled(!paused);

    // Fige delayedCall (attaques, countdown, fusibles différés) sans avancer this.time.now-based deadlines
    this.time.paused = paused;

    if (paused) {
      this.tweens.pauseAll();
      this.cameras.main.setAngle(0);
    } else {
      this.tweens.resumeAll();
    }
  }

  /** Active / coupe les hitboxes ◀ ▶ (pas le bouton pause) */
  private setLaneButtonsEnabled(on: boolean): void {
    for (const hit of this.hudHits) {
      if (hit === (this.pauseBtnHit as unknown as Phaser.GameObjects.Rectangle)) continue;
      if (on) {
        if (!hit.input) {
          hit.setInteractive({
            hitArea: new Phaser.Geom.Circle(0, 0, hit.width / 2 || 44),
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            useHandCursor: true,
          });
          if (hit.input) {
            (hit.input as Phaser.Types.Input.InteractiveObject & { alwaysEnabled?: boolean }).alwaysEnabled =
              true;
          }
        } else {
          hit.input.enabled = true;
        }
      } else if (hit.input) {
        hit.input.enabled = false;
      }
    }
  }
}
