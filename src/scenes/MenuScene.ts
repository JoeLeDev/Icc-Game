import Phaser from 'phaser';
import { computeLayout, readSafeAreaInsets, setCurrentLayout } from '../config/responsiveLayout';
import { applyDisplayWidth } from '../systems/SpriteDisplay';
import { audio } from '../utils/AudioManager';
import { Storage } from '../utils/Storage';

export class MenuScene extends Phaser.Scene {
  private soundBtn!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const layout = computeLayout(W, H, readSafeAreaInsets());
    setCurrentLayout(layout);

    this.drawBackground();

    // Brand
    this.add
      .text(W / 2, layout.padTop + 72, 'KHAYIL', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '42px',
        color: '#ff2d95',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, layout.padTop + 114, '2026', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '28px',
        color: '#e040fb',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, layout.padTop + 162, 'ÉQUIPÉE POUR\nCONQUÉRIR', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);

    // Decorative motorcycle
    const moto = this.add.image(W / 2, H * 0.45, 'player').setAlpha(0.95);
    applyDisplayWidth(moto, layout.menuPlayerWidth, layout.playerDisplayHeightMax * 1.4);

    const best = Storage.getBestDistance();
    this.add
      .text(W / 2, H * 0.57, best > 0 ? `Meilleure distance : ${best} m` : 'Prête à conquérir ?', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '13px',
        color: '#b39ddb',
      })
      .setOrigin(0.5);

    this.makeGradientButton(W / 2, H * 0.66, 'JOUER', () => {
      audio.ui();
      this.scene.start('Game');
    });

    // bottom row
    const y = H - layout.padBottom - 70;
    this.makeIconBtn(W * 0.22, y, '🏆', 'Classement\nlocal', () => this.showLeaderboard());
    this.makeIconBtn(W * 0.5, y, '?', 'Comment\njouer', () => {
      audio.ui();
      this.scene.start('Tutorial');
    });
    this.soundBtn = this.makeIconBtn(
      W * 0.78,
      y,
      audio.isEnabled() ? '🔊' : '🔇',
      'Son',
      () => {
        const on = audio.toggle();
        this.soundBtn.setText(on ? '🔊' : '🔇');
        audio.ui();
      },
    );
  }

  private drawBackground(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a0618, 0x0a0618, 0x2a1050, 0x1a0535, 1);
    g.fillRect(0, 0, W, H);

    // neon orbs
    for (let i = 0; i < 8; i++) {
      this.add.circle(
        Phaser.Math.Between(20, W - 20),
        Phaser.Math.Between(40, H - 40),
        Phaser.Math.Between(2, 4),
        Phaser.Math.RND.pick([0xff2d95, 0x00e5ff, 0x9b59ff]),
        0.5,
      );
    }
  }

  private makeGradientButton(x: number, y: number, label: string, cb: () => void): void {
    const bg = this.add.rectangle(x, y, 240, 56, 0x9b59ff, 1).setStrokeStyle(2, 0xff2d95);
    const shine = this.add.rectangle(x, y - 8, 236, 20, 0xff2d95, 0.35);
    const txt = this.add
      .text(x, y, label, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const hit = this.add
      .rectangle(x, y, 260, 64, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      bg.setScale(1.04);
      shine.setScale(1.04);
      txt.setScale(1.04);
    });
    hit.on('pointerout', () => {
      bg.setScale(1);
      shine.setScale(1);
      txt.setScale(1);
    });
    hit.on('pointerdown', cb);
  }

  private makeIconBtn(
    x: number,
    y: number,
    icon: string,
    caption: string,
    cb: () => void,
  ): Phaser.GameObjects.Text {
    const circle = this.add
      .circle(x, y - 10, 26, 0x1a0a30, 0.9)
      .setStrokeStyle(1, 0xe040fb, 0.6)
      .setInteractive({ useHandCursor: true });
    const ic = this.add
      .text(x, y - 10, icon, { fontSize: '20px' })
      .setOrigin(0.5);
    this.add
      .text(x, y + 28, caption, {
        fontFamily: 'Outfit',
        fontSize: '11px',
        color: '#ce93d8',
        align: 'center',
      })
      .setOrigin(0.5);
    circle.on('pointerdown', cb);
    return ic;
  }

  private showLeaderboard(): void {
    audio.ui();
    const board = Storage.getLeaderboard();
    const panel = this.add.container(this.scale.width / 2, this.scale.height / 2).setDepth(50);
    const bg = this.add.rectangle(0, 0, 320, 420, 0x0a0618, 0.95).setStrokeStyle(2, 0x9b59ff);
    const title = this.add
      .text(0, -180, 'CLASSEMENT LOCAL', {
        fontFamily: 'Orbitron',
        fontSize: '16px',
        color: '#ff2d95',
      })
      .setOrigin(0.5);
    const note = this.add
      .text(0, -155, '(uniquement sur cet appareil)', {
        fontFamily: 'Outfit',
        fontSize: '11px',
        color: '#9e9e9e',
      })
      .setOrigin(0.5);

    const lines: Phaser.GameObjects.GameObject[] = [bg, title, note];
    if (board.length === 0) {
      lines.push(
        this.add
          .text(0, 0, 'Aucune partie enregistrée', {
            fontFamily: 'Outfit',
            fontSize: '14px',
            color: '#b39ddb',
          })
          .setOrigin(0.5),
      );
    } else {
      board.slice(0, 8).forEach((s, i) => {
        const love = s.love ? ' ❤' : '';
        lines.push(
          this.add
            .text(
              0,
              -110 + i * 32,
              `${i + 1}. ${s.distance} m — ${s.equipment}/7${love}`,
              { fontFamily: 'Outfit', fontSize: '14px', color: '#fff' },
            )
            .setOrigin(0.5),
        );
      });
    }

    const close = this.add
      .rectangle(0, 175, 140, 40, 0x2a1050)
      .setStrokeStyle(1, 0xff2d95)
      .setInteractive({ useHandCursor: true });
    const closeTxt = this.add
      .text(0, 175, 'FERMER', { fontFamily: 'Outfit', fontSize: '14px', color: '#fff' })
      .setOrigin(0.5);
    close.on('pointerdown', () => panel.destroy());
    lines.push(close, closeTxt);
    panel.add(lines);
  }
}
