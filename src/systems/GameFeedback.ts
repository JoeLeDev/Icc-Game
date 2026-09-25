import type Phaser from 'phaser';
import type { LayoutMetrics } from '../config/responsiveLayout';
import { DEPTH } from './RoadProjection';

/** Retours visuels, particules et vibration d'une partie. */
export class GameFeedback {
  private readonly particles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly toastText: Phaser.GameObjects.Text;
  private readonly speedBannerText: Phaser.GameObjects.Text;
  private readonly flash: Phaser.GameObjects.Rectangle;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getLayout: () => LayoutMetrics,
  ) {
    const layout = getLayout();
    this.particles = scene.add.particles(0, 0, 'particle-gold', {
      speed: { min: 40, max: 160 },
      scale: { start: 1.1, end: 0 },
      lifespan: 480,
      emitting: false,
      tint: [0xffd54f, 0xff2d95, 0x00e5ff, 0xffffff],
    });
    this.particles.setDepth(DEPTH.fx);

    this.toastText = scene.add
      .text(layout.centerX, layout.playerY - 120, '', {
        fontFamily: 'Orbitron, sans-serif', fontSize: '16px', color: '#ffd54f',
        stroke: '#000', strokeThickness: 4, align: 'center',
      })
      .setOrigin(0.5).setAlpha(0).setDepth(DEPTH.hud + 10);

    this.speedBannerText = scene.add
      .text(layout.centerX, layout.gameHeight * 0.32, '', {
        fontFamily: 'Orbitron, sans-serif', fontSize: '15px', color: '#ff2d95',
        stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5).setAlpha(0).setDepth(DEPTH.hud + 10);

    this.flash = scene.add
      .rectangle(layout.browserWidth / 2, layout.browserHeight / 2, layout.browserWidth, layout.browserHeight, 0xffffff, 0)
      .setDepth(DEPTH.fx + 5);
  }

  applyLayout(layout: LayoutMetrics): void {
    this.flash.setPosition(layout.browserWidth / 2, layout.browserHeight / 2)
      .setSize(layout.browserWidth, layout.browserHeight);
    this.toastText.setPosition(layout.centerX, layout.playerY - 120);
    this.speedBannerText.setPosition(layout.centerX, layout.gameHeight * 0.32);
  }

  toast(message: string, color = '#ffd54f'): void {
    const layout = this.getLayout();
    const baseY = layout.playerY - 120;
    this.toastText.setText(message).setColor(color).setAlpha(1).setScale(1.1);
    this.toastText.setPosition(layout.centerX, baseY);
    this.scene.tweens.killTweensOf(this.toastText);
    this.scene.tweens.add({
      targets: this.toastText, alpha: 0, y: baseY - 20, duration: 1400, delay: 400,
      onComplete: () => { this.toastText.y = baseY; },
    });
  }

  speedBanner(equipmentCount: number): void {
    this.speedBannerText.setText(`VITESSE AUGMENTÉE — ${equipmentCount}/7`).setAlpha(1);
    this.scene.tweens.add({ targets: this.speedBannerText, alpha: 0, duration: 1600, delay: 800 });
    this.scene.cameras.main.flash(200, 255, 45, 149, false, undefined, this.scene);
  }

  flashScreen(color: number, alpha: number): void {
    this.flash.setFillStyle(color, 1).setAlpha(Math.min(0.2, alpha));
    this.scene.tweens.killTweensOf(this.flash);
    this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 220 });
  }

  burst(x: number, y: number): void {
    this.particles.emitParticleAt(x, y, 18);
  }

  vibrate(ms: number): void {
    try { navigator.vibrate?.(ms); } catch { /* navigateur non compatible */ }
  }
}
