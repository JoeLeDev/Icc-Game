import Phaser from 'phaser';
import {
  BONUSES,
  CONFIG,
  EQUIPMENTS,
  EquipmentId,
  GAME_H,
  GAME_W,
  LANE_X,
  LANES,
  getScrollSpeed,
  getTier,
} from '../config/gameConfig';
import { audio } from '../utils/AudioManager';
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
}

interface ActiveEffect {
  id: string;
  remaining: number;
}

export class GameScene extends Phaser.Scene {
  private roads: Phaser.GameObjects.TileSprite[] = [];
  private player!: Phaser.GameObjects.Container;
  private playerSprite!: Phaser.GameObjects.Image;
  private playerGlow!: Phaser.GameObjects.Arc;
  private loveAura!: Phaser.GameObjects.Arc;

  private lane: number = CONFIG.player.startLane;
  private targetX: number = LANE_X[CONFIG.player.startLane];
  private lives: number = CONFIG.player.maxLives;
  private invincibleUntil = 0;
  private hasTempShield = false;

  private collected = new Set<EquipmentId>();
  private loveCollected = false;
  private distance = 0;
  private obstaclesAvoided = 0;

  private entities: LaneEntity[] = [];
  private effects: ActiveEffect[] = [];

  private scrollSpeed: number = CONFIG.speed.base;
  private worldTimeScale = 1;
  private playing = false;
  private paused = false;
  private finalPhase = false;
  private finalTimer = 0;
  private gameOver = false;
  private won = false;

  private spawnTimers = {
    obstacle: 1.5,
    equipment: 2.5,
    bonus: 8,
    attack: 6,
  };

  private closedLane: number | null = null;
  private closeUntil = 0;
  private closeWarnUntil = 0;
  private closeBarrier: Phaser.GameObjects.Image | null = null;

  private distractionUntil = 0;
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
  private leftBtn!: Phaser.GameObjects.Container;
  private rightBtn!: Phaser.GameObjects.Container;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private pauseMenuHits: Phaser.GameObjects.Rectangle[] = [];

  private swipeStartX = 0;
  private keys!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    esc: Phaser.Input.Keyboard.Key;
  };

  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastSpeedTier = -1;
  private cityBuildings: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('Game');
  }

  create(): void {
    this.resetState();
    this.createWorld();
    this.createPlayer();
    this.createHud();
    this.createPauseOverlay();
    this.setupInput();
    this.createParticles();
    this.startCountdown();
  }

  private resetState(): void {
    this.lane = CONFIG.player.startLane;
    this.targetX = LANE_X[this.lane];
    this.lives = CONFIG.player.maxLives;
    this.invincibleUntil = 0;
    this.hasTempShield = false;
    this.collected.clear();
    this.loveCollected = false;
    this.distance = 0;
    this.obstaclesAvoided = 0;
    this.entities = [];
    this.effects = [];
    this.scrollSpeed = CONFIG.speed.base;
    this.worldTimeScale = 1;
    this.playing = false;
    this.paused = false;
    this.finalPhase = false;
    this.finalTimer = 0;
    this.gameOver = false;
    this.won = false;
    this.closedLane = null;
    this.spawnTimers = { obstacle: 2.2, equipment: 1.8, bonus: 10, attack: 8 };
    this.lastSpeedTier = -1;
  }

  private createWorld(): void {
    // sky
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x1a0a40, 0x1a0a40, 0xff6b9d, 0x7c4dff, 1);
    sky.fillRect(0, 0, GAME_W, GAME_H * 0.35);

    // distant city silhouette
    for (let i = 0; i < 14; i++) {
      const h = Phaser.Math.Between(40, 120);
      const b = this.add.rectangle(
        20 + i * 28,
        GAME_H * 0.32 - h / 2,
        Phaser.Math.Between(18, 30),
        h,
        Phaser.Math.RND.pick([0x12082a, 0x1a0f38, 0x0d0620]),
      );
      // neon windows
      for (let w = 0; w < 3; w++) {
        this.add.rectangle(
          b.x - 6 + (w % 2) * 10,
          b.y - h / 2 + 10 + w * 14,
          4,
          6,
          Phaser.Math.RND.pick([0xff2d95, 0x00e5ff, 0x9b59ff]),
          0.55,
        );
      }
      this.cityBuildings.push(b);
    }

    // road layers
    for (let i = 0; i < 16; i++) {
      const road = this.add.tileSprite(GAME_W / 2, i * 64, GAME_W, 64, 'road');
      this.roads.push(road);
    }

    // side neon glow
    const leftGlow = this.add.rectangle(20, GAME_H / 2, 8, GAME_H, 0x9b59ff, 0.15);
    const rightGlow = this.add.rectangle(GAME_W - 20, GAME_H / 2, 8, GAME_H, 0xff2d95, 0.15);

    this.distractionOverlay = this.add
      .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x00e5ff, 0)
      .setDepth(50);
  }

  private createPlayer(): void {
    const y = GAME_H * CONFIG.player.yRatio;
    this.playerGlow = this.add.circle(0, 10, 36, 0xff2d95, 0.15);
    this.loveAura = this.add.circle(0, 0, 55, 0xff80ab, 0).setStrokeStyle(3, 0xff2d95, 0);
    this.playerSprite = this.add.image(0, 0, 'player');
    this.player = this.add.container(this.targetX, y, [this.playerGlow, this.loveAura, this.playerSprite]);
    this.player.setDepth(20);
    this.player.setSize(CONFIG.player.hitboxW, CONFIG.player.hitboxH);
  }

  private createParticles(): void {
    this.particles = this.add.particles(0, 0, 'particle', {
      speed: { min: 40, max: 160 },
      scale: { start: 1.2, end: 0 },
      lifespan: 500,
      emitting: false,
      tint: [0xffd54f, 0xff2d95, 0x00e5ff, 0xffffff],
    });
    this.particles.setDepth(40);
  }

  private createHud(): void {
    // hearts
    for (let i = 0; i < CONFIG.player.maxLives; i++) {
      const h = this.add.image(24 + i * 34, 28, 'heart').setScrollFactor(0).setDepth(100);
      this.hudHearts.push(h);
    }

    this.hudEqText = this.add
      .text(GAME_W / 2, 22, 'Équipements : 0/7', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '14px',
        color: '#fff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.hudDist = this.add
      .text(GAME_W - 52, 28, '0 M', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '13px',
        color: '#fff',
      })
      .setOrigin(0.5)
      .setDepth(100);

    // equipment column — inset pour ne pas être coupée par le bord
    const eqPanel = this.add
      .rectangle(36, 70 + 3 * 36, 40, 7 * 36 + 8, 0x0a0618, 0.45)
      .setStrokeStyle(1, 0x9b59ff, 0.35)
      .setDepth(99)
      .setScrollFactor(0);
    void eqPanel;

    EQUIPMENTS.forEach((eq, i) => {
      const icon = this.add
        .image(36, 70 + i * 36, `eq-icon-${eq.id}`)
        .setOrigin(0.5)
        .setAlpha(0.35)
        .setDepth(100)
        .setScrollFactor(0)
        .setDisplaySize(30, 30);
      this.hudEqIcons.push(icon);
    });

    this.hudEffects = this.add
      .text(GAME_W / 2, 48, '', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '12px',
        color: '#00e5ff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.toast = this.add
      .text(GAME_W / 2, GAME_H * 0.38, '', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '18px',
        color: '#ffd54f',
        stroke: '#000',
        strokeThickness: 4,
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(110);

    this.speedBanner = this.add
      .text(GAME_W / 2, GAME_H * 0.3, '', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '16px',
        color: '#ff2d95',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(110);

    this.flash = this.add
      .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffffff, 0)
      .setDepth(90);

    this.countdownText = this.add
      .text(GAME_W / 2, GAME_H * 0.42, '', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '96px',
        color: '#ff2d95',
        stroke: '#fff',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(120)
      .setAlpha(0);

    // pause button
    this.pauseBtn = this.makeButton(GAME_W - 28, 28, 'Ⅱ', () => this.togglePause(), 36);
    this.pauseBtn.setDepth(150);

    // touch lane buttons — zones larges et toujours cliquables
    this.leftBtn = this.makeButton(48, GAME_H - 56, '◀', () => this.changeLane(-1), 52, 0.55);
    this.rightBtn = this.makeButton(GAME_W - 48, GAME_H - 56, '▶', () => this.changeLane(1), 52, 0.55);
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    cb: () => void,
    size = 40,
    alpha = 0.55,
  ): Phaser.GameObjects.Container {
    const hitPad = Math.max(72, size + 24);
    const bg = this.add.circle(0, 0, size / 2, 0x1a0a30, alpha).setStrokeStyle(2, 0xff2d95, 0.85);
    const txt = this.add
      .text(0, 0, label, { fontFamily: 'Outfit', fontSize: `${Math.round(size * 0.45)}px`, color: '#fff' })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [bg, txt]).setDepth(150).setScrollFactor(0);

    // Hitbox monde toujours active (même quasi invisible)
    const hit = this.add.rectangle(x, y, hitPad, hitPad, 0xffffff, 0.01).setScrollFactor(0).setDepth(160);
    hit.setInteractive({ useHandCursor: true });
    if (hit.input) {
      (hit.input as Phaser.Types.Input.InteractiveObject & { alwaysEnabled?: boolean }).alwaysEnabled = true;
    }
    (hit as Phaser.GameObjects.Rectangle & { isHudControl?: boolean }).isHudControl = true;

    const press = () => {
      bg.setFillStyle(0x9b59ff, 0.9);
      this.time.delayedCall(100, () => bg.setFillStyle(0x1a0a30, alpha));
      if (label === 'Ⅱ') {
        if (this.gameOver || this.won) return;
        audio.ui();
        cb();
        return;
      }
      if (!this.canControl()) return;
      audio.ui();
      cb();
    };

    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Empêche le swipe global de traiter ce tap
      this.swipeStartX = Number.NaN;
      pointer.event?.preventDefault?.();
      press();
    });

    return c;
  }

  private createPauseOverlay(): void {
    this.pauseMenuHits = [];
    const bg = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x070412, 0.82);
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

    this.pauseOverlay = this.add.container(GAME_W / 2, GAME_H / 2, [bg, title, resume, restart, home]);
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
    // Focus canvas pour recevoir le clavier
    const canvas = this.game.canvas;
    canvas.setAttribute('tabindex', '0');
    canvas.style.outline = 'none';
    this.input.on('pointerdown', () => canvas.focus());

    const kb = this.input.keyboard;
    if (kb) {
      // Empêche le scroll de la page avec les flèches
      kb.addCapture([
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.A,
        Phaser.Input.Keyboard.KeyCodes.D,
        Phaser.Input.Keyboard.KeyCodes.ESC,
      ]);

      this.keys = {
        left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, true),
        right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, true),
        a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A, true),
        d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D, true),
        esc: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, true),
      };

      // Écoute directe — plus fiable que JustDown seul
      kb.on('keydown-LEFT', () => this.changeLane(-1));
      kb.on('keydown-RIGHT', () => this.changeLane(1));
      kb.on('keydown-A', () => this.changeLane(-1));
      kb.on('keydown-D', () => this.changeLane(1));
      kb.on('keydown-ESC', () => this.togglePause());
    }

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const hits = this.input.hitTestPointer(p);
      const onHud = hits.some(
        (obj) => (obj as Phaser.GameObjects.GameObject & { isHudControl?: boolean }).isHudControl,
      );
      this.swipeStartX = onHud ? Number.NaN : p.x;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.canControl() || Number.isNaN(this.swipeStartX)) return;
      const dx = p.x - this.swipeStartX;
      if (Math.abs(dx) > 40) this.changeLane(dx > 0 ? 1 : -1);
    });
  }

  private canControl(): boolean {
    return this.playing && !this.paused && !this.gameOver && !this.won;
  }

  private changeLane(dir: number): void {
    if (!this.canControl()) return;
    let next = Phaser.Math.Clamp(this.lane + dir, 0, LANES - 1);
    // can't enter closed lane
    if (this.closedLane !== null && next === this.closedLane && this.time.now < this.closeUntil) {
      // try skip if possible
      const skip = next + dir;
      if (skip >= 0 && skip < LANES) next = skip;
      else return;
    }
    if (next === this.lane) return;
    this.lane = next;
    this.targetX = LANE_X[this.lane];
    this.tweens.add({
      targets: this.player,
      x: this.targetX,
      duration: CONFIG.player.laneSwitchDuration * 1000,
      ease: 'Sine.easeOut',
    });
  }

  private startCountdown(): void {
    const steps = ['3', '2', '1', 'GO !'];
    let i = 0;
    const tick = () => {
      if (i >= steps.length) {
        this.countdownText.setAlpha(0);
        this.playing = true;
        // Grâce de démarrage
        this.invincibleUntil = this.time.now + 2000;
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
    if (this.paused || this.gameOver || this.won) return;

    if (!this.playing) {
      // idle road scroll slow
      this.scrollRoad(delta * 0.0003 * 80);
      return;
    }

    const dt = (delta / 1000) * this.worldTimeScale;
    const eqCount = this.collected.size;
    const boost = this.hasEffect('boost');
    const slowmo = this.hasEffect('slowmo');
    this.scrollSpeed = getScrollSpeed(eqCount, boost, slowmo);
    this.worldTimeScale = slowmo ? 1 : 1; // slowmo already in scrollSpeed; entity logic uses dt

    // speed banner on tier change
    const tier = getTier(eqCount);
    if (tier !== this.lastSpeedTier && tier >= 2 && !this.finalPhase) {
      this.showSpeedBanner(tier);
    }
    this.lastSpeedTier = tier;

    this.scrollRoad(this.scrollSpeed * dt);
    this.distance += (this.scrollSpeed * dt) / CONFIG.scoring.distancePerMeter;
    this.hudDist.setText(`${Math.floor(this.distance)} M`);

    this.tickEffects(dt);
    this.tickSpawns(dt);
    this.tickEntities(dt);
    this.tickLaneClosure();
    this.tickDistraction();
    this.tickInvincibility();
    this.tickMagnet(dt);
    this.tickLoveDestroy();
    this.tickFinalPhase(dt);
    this.updateHudEffects();
  }

  private scrollRoad(amount: number): void {
    for (const road of this.roads) {
      road.tilePositionY -= amount * 0.15;
      road.y += amount;
      if (road.y > GAME_H + 32) road.y -= 16 * 64;
    }
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

    // boost glow
    const boost = this.hasEffect('boost');
    this.playerGlow.setFillStyle(boost ? 0xff6e40 : 0xff2d95, boost ? 0.35 : 0.15);
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
      if (labels[e.id]) parts.push(`${labels[e.id]} ${e.remaining.toFixed(1)}s`);
    }
    if (this.hasTempShield) parts.push('Bouclier');
    this.hudEffects.setText(parts.join(' · '));
  }

  private tickSpawns(dt: number): void {
    if (this.finalPhase && this.finalTimer < 2) return; // brief calm then chaos then finish

    const tier = getTier(this.collected.size);
    this.spawnTimers.obstacle -= dt;
    this.spawnTimers.equipment -= dt;
    this.spawnTimers.bonus -= dt;
    this.spawnTimers.attack -= dt;

    if (this.spawnTimers.obstacle <= 0) {
      this.spawnObstaclePattern(tier);
      this.spawnTimers.obstacle = CONFIG.spawn.obstacleInterval[tier] * Phaser.Math.FloatBetween(0.85, 1.15);
    }
    if (this.spawnTimers.equipment <= 0 && this.collected.size < 7) {
      this.spawnEquipment();
      this.spawnTimers.equipment = CONFIG.spawn.equipmentInterval[tier] * Phaser.Math.FloatBetween(0.9, 1.2);
    }
    if (this.spawnTimers.bonus <= 0) {
      this.spawnBonusOrLove();
      this.spawnTimers.bonus = CONFIG.spawn.bonusInterval[tier] * Phaser.Math.FloatBetween(0.9, 1.3);
    }
    if (this.spawnTimers.attack <= 0 && tier >= 1) {
      this.spawnAttack(tier);
      this.spawnTimers.attack = CONFIG.spawn.attackInterval[tier] * Phaser.Math.FloatBetween(0.85, 1.2);
    }
  }

  /** Garantit toujours au moins une voie libre */
  private freeLanes(blocked: number[]): number[] {
    return [0, 1, 2].filter((l) => !blocked.includes(l) && l !== this.closedLane);
  }

  private spawnY(): number {
    // anticipation: spawn above screen based on speed * reaction time
    return -40 - this.scrollSpeed * CONFIG.spawn.reactionTime * 0.15;
  }

  private laneBusyNear(lane: number, y: number, gap: number = CONFIG.spawn.minGapFront): boolean {
    return this.entities.some(
      (e) => e.lane === lane && Math.abs((e.sprite as Phaser.GameObjects.Image).y - y) < gap,
    );
  }

  private spawnObstaclePattern(tier: number): void {
    const y = this.spawnY();
    const roll = Math.random();

    // never block all 3 lanes — and never the player's lane alone without escape
    if (tier >= 4 && roll < 0.22) {
      const blocked = Phaser.Utils.Array.Shuffle([0, 1, 2]).slice(0, 2);
      const free = this.freeLanes(blocked);
      if (free.length === 0) return;
      for (const lane of blocked) {
        if (!this.laneBusyNear(lane, y)) this.spawnObstacle(lane, y);
      }
    } else if (tier >= 2 && roll < 0.4) {
      // Prefer not spawning on player's current lane at low tiers
      let lane = Phaser.Math.Between(0, 2);
      if (tier < 4 && Math.random() < 0.55) {
        const others = [0, 1, 2].filter((l) => l !== this.lane && l !== this.closedLane);
        if (others.length) lane = Phaser.Utils.Array.GetRandom(others);
      }
      if (lane !== this.closedLane && !this.laneBusyNear(lane, y)) {
        this.spawnObstacle(lane, y, Math.random() < 0.25 && tier >= 3 ? 'truck' : 'car');
      }
    } else {
      let lane = Phaser.Math.Between(0, 2);
      if (tier < 3 && Math.random() < 0.6) {
        const others = [0, 1, 2].filter((l) => l !== this.lane && l !== this.closedLane);
        if (others.length) lane = Phaser.Utils.Array.GetRandom(others);
      }
      if (lane !== this.closedLane && !this.laneBusyNear(lane, y)) {
        const kinds = ['car', 'barrier', 'cone', 'hole'] as const;
        let kind: string = Phaser.Utils.Array.GetRandom([...kinds]);
        if (tier >= 5 && Math.random() < 0.35) kind = 'barrel';
        if (tier >= 3 && Math.random() < 0.2) kind = 'truck';
        this.spawnObstacle(lane, y, kind);
      }
    }
  }

  private spawnObstacle(lane: number, y: number, kind = 'car'): void {
    let key = 'car';
    let entKind: EntityKind = 'obstacle';
    if (kind === 'truck') key = 'truck';
    else if (kind === 'barrier') key = 'barrier';
    else if (kind === 'cone') key = 'cone';
    else if (kind === 'hole') key = 'hole';
    else if (kind === 'barrel') {
      key = 'barrel';
      entKind = 'barrel';
    }

    const sprite = this.add.image(LANE_X[lane], y, key).setDepth(15);
    const ent: LaneEntity = { sprite, lane, kind: entKind, hit: false };
    if (entKind === 'barrel') {
      ent.fuse = CONFIG.barrel.fuseDuration;
      ent.fuseMax = CONFIG.barrel.fuseDuration;
      ent.warning = this.add
        .circle(LANE_X[lane], y, CONFIG.barrel.blastRadius, 0xff1744, 0.12)
        .setStrokeStyle(2, 0xffeb3b, 0.7)
        .setDepth(14);
      ent.label = this.add
        .text(LANE_X[lane], y - 36, `${ent.fuse!.toFixed(1)}`, {
          fontFamily: 'Orbitron',
          fontSize: '12px',
          color: '#ffeb3b',
        })
        .setOrigin(0.5)
        .setDepth(16);
    }
    this.entities.push(ent);
  }

  private spawnEquipment(): void {
    const missing = EQUIPMENTS.filter((e) => !this.collected.has(e.id));
    if (missing.length === 0) return;
    // prefer missing; allow duplicates of missing only — duplicates of collected can spawn but won't count
    // Brief: missed must reappear; duplicates don't increase counter
    const pool = missing.length > 0 ? missing : [...EQUIPMENTS];
    // weight missing higher
    const pick =
      Math.random() < 0.85 || missing.length === 0
        ? Phaser.Utils.Array.GetRandom(missing.length ? missing : pool)
        : Phaser.Utils.Array.GetRandom([...EQUIPMENTS]);

    const free = this.freeLanes([]);
    if (!free.length) return;
    const lane = Phaser.Utils.Array.GetRandom(free);
    const y = this.spawnY() - 40;
    if (this.laneBusyNear(lane, y, 100)) return;

    const sprite = this.add.image(LANE_X[lane], y, `eq-${pick.id}`).setDepth(16);
    this.tweens.add({
      targets: sprite,
      scale: 1.12,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    this.entities.push({
      sprite,
      lane,
      kind: 'equipment',
      equipmentId: pick.id,
      hit: false,
    });
  }

  private spawnBonusOrLove(): void {
    const free = this.freeLanes([]);
    if (!free.length) return;
    const lane = Phaser.Utils.Array.GetRandom(free);
    const y = this.spawnY() - 20;
    if (this.laneBusyNear(lane, y, 100)) return;

    if (Math.random() < CONFIG.spawn.loveChance && !this.hasEffect('love')) {
      const sprite = this.add.image(LANE_X[lane], y, 'love').setDepth(16);
      this.tweens.add({ targets: sprite, scale: 1.2, duration: 400, yoyo: true, repeat: -1 });
      this.entities.push({ sprite, lane, kind: 'love', hit: false });
      return;
    }

    const bonus = Phaser.Utils.Array.GetRandom([...BONUSES]);
    // skip life if full
    if (bonus.id === 'life' && this.lives >= CONFIG.player.maxLives) {
      const alt = BONUSES.filter((b) => b.id !== 'life');
      const b2 = Phaser.Utils.Array.GetRandom(alt);
      const sprite = this.add.image(LANE_X[lane], y, `bonus-${b2.id}`).setDepth(16);
      this.entities.push({ sprite, lane, kind: 'bonus', bonusId: b2.id, hit: false });
      return;
    }
    const sprite = this.add.image(LANE_X[lane], y, `bonus-${bonus.id}`).setDepth(16);
    this.entities.push({ sprite, lane, kind: 'bonus', bonusId: bonus.id, hit: false });
  }

  private spawnAttack(tier: number): void {
    const types = ['depression', 'calomnie', 'colere', 'peur', 'doute', 'reject', 'distraction'] as const;
    let pool = [...types];
    if (tier < 3) pool = ['depression', 'doute', 'calomnie'];
    else if (tier < 5) pool = ['depression', 'calomnie', 'colere', 'peur', 'doute'];
    else if (tier >= 6) pool = [...types];

    // from behind chance
    if (tier >= 4 && Math.random() < 0.2) {
      this.spawnFromBehind();
      return;
    }

    const type = Phaser.Utils.Array.GetRandom(pool);
    switch (type) {
      case 'depression':
        this.spawnDepression();
        break;
      case 'calomnie':
        this.spawnCalomnie();
        break;
      case 'colere':
        this.spawnColere();
        break;
      case 'peur':
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
    }
  }

  private spawnDepression(): void {
    const free = this.freeLanes([]);
    if (free.length < 1) return;
    // dark mass covering one lane, slow
    const lane = Phaser.Utils.Array.GetRandom(free);
    const y = this.spawnY();
    const sprite = this.add.image(LANE_X[lane], y, 'depression').setDepth(14).setAlpha(0.9);
    this.showToast('DÉPRESSION', '#7e57c2');
    this.entities.push({ sprite, lane, kind: 'depression', hit: false });
  }

  private spawnCalomnie(): void {
    // side attackers shoot projectiles across
    const fromLeft = Math.random() < 0.5;
    const y = GAME_H * Phaser.Math.FloatBetween(0.25, 0.55);
    const sx = fromLeft ? -30 : GAME_W + 30;
    const attacker = this.add.image(sx, y, 'calomnie').setDepth(18);
    this.showToast('CALOMNIE', '#ea80fc');
    this.tweens.add({
      targets: attacker,
      x: fromLeft ? 30 : GAME_W - 30,
      duration: 400,
      onComplete: () => {
        // fire 3 projectiles toward player lanes
        for (let i = 0; i < 3; i++) {
          this.time.delayedCall(i * 280, () => {
            if (!this.playing || this.paused) return;
            const proj = this.add.image(attacker.x, attacker.y, 'projectile').setDepth(18);
            const targetLane = Phaser.Math.Between(0, 2);
            const vx = fromLeft ? 220 : -220;
            this.entities.push({
              sprite: proj,
              lane: targetLane,
              kind: 'projectile',
              hit: false,
              vx,
            });
            // also drift toward lane
            this.tweens.add({
              targets: proj,
              y: this.player.y - 20 + Phaser.Math.Between(-30, 30),
              duration: 900,
            });
          });
        }
        this.time.delayedCall(1200, () => {
          this.tweens.add({
            targets: attacker,
            x: fromLeft ? -40 : GAME_W + 40,
            duration: 400,
            onComplete: () => attacker.destroy(),
          });
        });
      },
    });
  }

  private spawnColere(): void {
    const free = this.freeLanes([]);
    if (!free.length) return;
    const lane = Phaser.Utils.Array.GetRandom(free);
    const y = this.spawnY();
    const sprite = this.add.image(LANE_X[lane], y, 'colere').setDepth(15);
    this.showToast('COLÈRE', '#ff3d00');
    this.entities.push({ sprite, lane, kind: 'colere', hit: false, fuse: 1.8, fuseMax: 1.8 });
  }

  private spawnPeur(): void {
    const free = this.freeLanes([]);
    if (!free.length) return;
    const lane = Phaser.Utils.Array.GetRandom(free);
    const y = this.player.y - 180;
    // warning first
    const warn = this.add
      .text(LANE_X[lane], y, '⚠', {
        fontSize: '28px',
        color: '#ffeb3b',
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.showToast('PEUR', '#b388ff');
    this.tweens.add({
      targets: warn,
      alpha: 0.3,
      duration: 200,
      yoyo: true,
      repeat: 3,
    });
    this.time.delayedCall(CONFIG.fear.warningDuration * 1000, () => {
      warn.destroy();
      if (!this.playing) return;
      const sprite = this.add.image(LANE_X[lane], y, 'peur').setDepth(17);
      this.entities.push({ sprite, lane, kind: 'peur', hit: false, life: 2.5 });
    });
  }

  private spawnDoute(): void {
    const free = this.freeLanes([]);
    if (!free.length) return;
    const lane = Phaser.Utils.Array.GetRandom(free);
    const y = this.spawnY();
    const sprite = this.add.image(LANE_X[lane], y, 'doute').setDepth(16).setAlpha(0.85);
    this.entities.push({ sprite, lane, kind: 'doute', hit: false, isDoubt: true });
  }

  private spawnReject(): void {
    if (this.closedLane !== null) return;
    // close a side lane, never center if player is cornered badly — prefer not player's lane if only one free
    const candidates = [0, 2, 1].filter((l) => l !== this.lane);
    const lane: number = candidates[0] ?? 0;
    this.closedLane = lane;
    this.closeWarnUntil = this.time.now + CONFIG.laneClosure.warningDuration * 1000;
    this.closeUntil = this.time.now + (CONFIG.laneClosure.warningDuration + CONFIG.laneClosure.duration) * 1000;
    this.showToast('REJET — voie fermée', '#ff1744');

    const warn = this.add
      .rectangle(LANE_X[lane], GAME_H / 2, 70, GAME_H, 0xff1744, 0.15)
      .setDepth(12)
      .setStrokeStyle(2, 0xff1744, 0.8);
    this.tweens.add({ targets: warn, alpha: 0.05, duration: 300, yoyo: true, repeat: 2 });
    this.time.delayedCall(CONFIG.laneClosure.warningDuration * 1000, () => {
      warn.destroy();
      this.closeBarrier = this.add.image(LANE_X[lane], this.player.y - 100, 'reject').setDepth(16);
      if (this.lane === lane) this.changeLane(lane === 0 ? 1 : -1);
    });
  }

  private spawnFromBehind(): void {
    const free = this.freeLanes([]);
    if (!free.length) return;
    const lane = Phaser.Utils.Array.GetRandom(free);
    const sprite = this.add.image(LANE_X[lane], GAME_H + 40, 'car').setDepth(15).setTint(0xff5252);
    this.showToast('Attaque arrière !', '#ff5252');
    this.entities.push({
      sprite,
      lane,
      kind: 'obstacle',
      hit: false,
      fromBehind: true,
      life: 3.5,
    });
  }

  private triggerDistraction(): void {
    this.distractionUntil = this.time.now + CONFIG.distraction.duration * 1000;
    this.showToast('DISTRACTION', '#00e5ff');
    this.distractionOverlay.setFillStyle(0x00e5ff, 0.08);
  }

  private tickDistraction(): void {
    if (this.time.now < this.distractionUntil) {
      this.cameras.main.setAngle(Math.sin(this.time.now / 80) * 0.6);
      this.distractionOverlay.setAlpha(0.06 + Math.sin(this.time.now / 100) * 0.04);
    } else {
      this.cameras.main.setAngle(0);
      this.distractionOverlay.setAlpha(0);
    }
  }

  private tickLaneClosure(): void {
    if (this.closedLane === null) return;
    if (this.closeBarrier) {
      this.closeBarrier.y = this.player.y - 80;
    }
    if (this.time.now >= this.closeUntil) {
      this.closedLane = null;
      this.closeBarrier?.destroy();
      this.closeBarrier = null;
    }
  }

  private tickEntities(dt: number): void {
    const py = this.player.y;
    const px = this.player.x;

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      const sp = e.sprite as Phaser.GameObjects.Image;

      if (e.fromBehind) {
        sp.y -= (this.scrollSpeed * 0.55 + 80) * dt;
        e.life = (e.life ?? 3) - dt;
      } else if (e.kind === 'projectile') {
        sp.x += (e.vx ?? 0) * dt;
        sp.y += this.scrollSpeed * 0.15 * dt;
      } else if (e.kind === 'peur') {
        // chases player lane slowly
        const tx = LANE_X[this.lane];
        sp.x = Phaser.Math.Linear(sp.x, tx, 2 * dt);
        sp.y += this.scrollSpeed * 0.4 * dt;
        e.life = (e.life ?? 2) - dt;
      } else {
        sp.y += this.scrollSpeed * dt;
      }

      if (e.warning) {
        e.warning.x = sp.x;
        e.warning.y = sp.y;
        e.warning.setAlpha(0.1 + Math.sin(this.time.now / 100) * 0.08);
      }
      if (e.label) {
        e.label.x = sp.x;
        e.label.y = sp.y - 36;
      }

      // barrel fuse
      if (e.kind === 'barrel' && e.fuse !== undefined) {
        e.fuse -= dt;
        e.label?.setText(Math.max(0, e.fuse).toFixed(1));
        if (e.fuse <= 0) {
          this.explodeAt(sp.x, sp.y, CONFIG.barrel.blastRadius);
          this.destroyEntity(i);
          continue;
        }
      }

      // colere becomes fire zone
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

      if (e.life !== undefined && e.life <= 0 && e.kind === 'peur') {
        this.destroyEntity(i);
        continue;
      }
      if (e.fromBehind && (e.life ?? 0) <= 0) {
        this.obstaclesAvoided++;
        this.destroyEntity(i);
        continue;
      }

      // off screen
      if (sp.y > GAME_H + 80 || sp.y < -200 || sp.x < -80 || sp.x > GAME_W + 80) {
        if (e.kind === 'obstacle' || e.kind === 'depression' || e.kind === 'barrel') {
          this.obstaclesAvoided++;
        }
        this.destroyEntity(i);
        continue;
      }

      // collision
      if (e.hit) continue;
      const hw = CONFIG.player.hitboxW * 0.45;
      const hh = CONFIG.player.hitboxH * 0.4;
      const dx = Math.abs(sp.x - px);
      const dy = Math.abs(sp.y - py);
      const reachX = sp.displayWidth * 0.28 + hw;
      const reachY = sp.displayHeight * 0.28 + hh;

      if (dx < reachX && dy < reachY) {
        this.handlePickupOrHit(e, i);
      }
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
    e.hit = true;
    const sp = e.sprite as Phaser.GameObjects.Image;

    if (e.kind === 'equipment' && e.equipmentId) {
      this.collectEquipment(e.equipmentId, sp.x, sp.y);
      this.destroyEntity(index);
      return;
    }
    if (e.kind === 'bonus' && e.bonusId) {
      this.collectBonus(e.bonusId, sp.x, sp.y);
      this.destroyEntity(index);
      return;
    }
    if (e.kind === 'love') {
      this.collectLove(sp.x, sp.y);
      this.destroyEntity(index);
      return;
    }
    if (e.kind === 'doute' || e.isDoubt) {
      // leurre — pas de dégât, disparaît avec feedback
      this.showToast('Doute dissipé', '#90a4ae');
      audio.ui();
      this.burst(sp.x, sp.y, 0x90a4ae);
      this.destroyEntity(index);
      return;
    }

    // damage
    this.takeHit(sp.x, sp.y);
    this.destroyEntity(index);
  }

  private collectEquipment(id: EquipmentId, x: number, y: number): void {
    const eq = EQUIPMENTS.find((e) => e.id === id)!;
    const isNew = !this.collected.has(id);
    if (isNew) {
      this.collected.add(id);
      const idx = EQUIPMENTS.findIndex((e) => e.id === id);
      this.hudEqIcons[idx].setAlpha(1);
      this.hudEqText.setText(`Équipements : ${this.collected.size}/7`);
    }
    audio.collect();
    this.vibrate(40);
    this.burst(x, y, eq.color);
    this.flashScreen(eq.color, 0.25);
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
    this.flashScreen(0xff80ab, 0.4);
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

  private takeHit(x: number, y: number): void {
    if (this.time.now < this.invincibleUntil) return;
    if (this.hasEffect('love')) return;
    if (this.hasEffect('boost') && CONFIG.effects.boostProtects) return;

    if (this.hasTempShield) {
      this.hasTempShield = false;
      this.showToast('Bouclier brisé !', '#69f0ae');
      audio.ui();
      this.burst(x, y, 0x69f0ae);
      this.invincibleUntil = this.time.now + 500;
      return;
    }

    this.lives -= 1;
    this.refreshHearts();
    audio.hit();
    this.vibrate(80);
    this.flashScreen(0xff1744, 0.35);
    this.cameras.main.shake(180, 0.01);
    this.invincibleUntil = this.time.now + CONFIG.player.invincibilityDuration * 1000;
    this.showToast('Touchée !', '#ff5252');

    if (this.lives <= 0) {
      this.endGame(false);
    }
  }

  private tickInvincibility(): void {
    if (this.time.now < this.invincibleUntil) {
      this.playerSprite.setAlpha(0.35 + Math.sin(this.time.now / 50) * 0.35);
    } else {
      this.playerSprite.setAlpha(1);
    }
  }

  private tickMagnet(dt: number): void {
    if (!this.hasEffect('magnet')) return;
    const r = CONFIG.effects.magnetRadius;
    for (const e of this.entities) {
      if (e.kind !== 'equipment' && e.kind !== 'bonus' && e.kind !== 'love') continue;
      const sp = e.sprite as Phaser.GameObjects.Image;
      const dx = this.player.x - sp.x;
      const dy = this.player.y - sp.y;
      const dist = Math.hypot(dx, dy);
      if (dist < r && dist > 1) {
        const pull = CONFIG.effects.magnetPull * dt;
        sp.x += (dx / dist) * pull;
        sp.y += (dy / dist) * pull;
      }
    }
  }

  private tickLoveDestroy(): void {
    if (!this.hasEffect('love')) return;
    const r = CONFIG.effects.loveDestroyRadius;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (
        e.kind === 'equipment' ||
        e.kind === 'bonus' ||
        e.kind === 'love' ||
        e.kind === 'doute'
      )
        continue;
      const sp = e.sprite as Phaser.GameObjects.Image;
      if (Math.hypot(sp.x - this.player.x, sp.y - this.player.y) < r) {
        this.burst(sp.x, sp.y, 0xff80ab);
        this.destroyEntity(i);
      }
    }
  }

  private explodeAt(x: number, y: number, radius: number): void {
    this.burst(x, y, 0xff3d00);
    this.flashScreen(0xff6e40, 0.3);
    const fire = this.add.image(x, y, 'colere').setDepth(16).setScale(1.4);
    this.entities.push({
      sprite: fire,
      lane: this.nearestLane(x),
      kind: 'firezone',
      hit: false,
      life: 1.5,
    });
    if (Math.hypot(x - this.player.x, y - this.player.y) < radius) {
      this.takeHit(x, y);
    }
  }

  private nearestLane(x: number): number {
    let best = 0;
    let d = Infinity;
    LANE_X.forEach((lx, i) => {
      const dd = Math.abs(lx - x);
      if (dd < d) {
        d = dd;
        best = i;
      }
    });
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
    // motion feel
    this.cameras.main.setAngle(Math.sin(this.time.now / 60) * 0.3);
    if (this.finalTimer <= 0) {
      this.endGame(true);
    }
  }

  private endGame(won: boolean): void {
    this.playing = false;
    this.won = won;
    this.gameOver = !won;
    this.cameras.main.setAngle(0);

    Storage.addScore({
      distance: Math.floor(this.distance),
      equipment: this.collected.size,
      love: this.loveCollected,
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
    };

    this.time.delayedCall(600, () => {
      this.scene.start(won ? 'Victory' : 'GameOver', payload);
    });
  }

  private refreshHearts(): void {
    this.hudHearts.forEach((h, i) => {
      h.setTexture(i < this.lives ? 'heart' : 'heart-empty');
    });
  }

  private showToast(msg: string, color = '#ffd54f'): void {
    this.toast.setText(msg).setColor(color).setAlpha(1).setScale(1.1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({
      targets: this.toast,
      alpha: 0,
      y: GAME_H * 0.38 - 20,
      duration: 1400,
      delay: 400,
      onComplete: () => {
        this.toast.y = GAME_H * 0.38;
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
    this.flash.setAlpha(alpha);
    this.tweens.killTweensOf(this.flash);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 280 });
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
    if (!this.playing && !this.paused) return;
    if (this.gameOver || this.won) return;
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    this.setPauseMenuInteractive(this.paused);
    if (this.paused) {
      this.tweens.pauseAll();
    } else {
      this.tweens.resumeAll();
    }
  }
}
