import Phaser from 'phaser';
import { EQUIPMENTS, EquipmentId } from '../config/gameConfig';
import { computeLayout, readSafeAreaInsets, setCurrentLayout } from '../config/responsiveLayout';
import {
  applyDisplayBox,
  applyDisplayWidth,
} from '../systems/SpriteDisplay';
import { audio } from '../utils/AudioManager';
import { formatShareText, shareResult } from '../utils/Share';
import { Storage } from '../utils/Storage';

interface EndData {
  won: boolean;
  equipment: number;
  collected: EquipmentId[];
  love: boolean;
  distance: number;
  avoided: number;
}

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('Victory');
  }

  create(data: EndData): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const layout = computeLayout(W, H, readSafeAreaInsets());
    setCurrentLayout(layout);

    this.add.rectangle(0, 0, W, H, 0x120828, 1).setOrigin(0);
    // celebratory glow
    this.add.circle(W / 2, H * 0.24, 120, 0xff2d95, 0.15);
    const moto = this.add.image(W / 2, H * 0.24, 'player');
    applyDisplayWidth(moto, layout.victoryPlayerWidth, layout.playerDisplayHeightMax * 1.3);

    this.add
      .text(W / 2, 320, 'TU ES ÉQUIPÉE\nPOUR CONQUÉRIR !', {
        fontFamily: 'Orbitron',
        fontSize: '24px',
        color: '#ff2d95',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(
        W / 2,
        400,
        `${data.distance} m  ·  ${data.equipment}/7  ·  ${data.avoided} esquivés`,
        { fontFamily: 'Outfit', fontSize: '13px', color: '#ce93d8' },
      )
      .setOrigin(0.5);

    const best = Storage.getBestDistance();
    this.add
      .text(W / 2, 425, `Record local : ${best} m`, {
        fontFamily: 'Outfit',
        fontSize: '12px',
        color: '#9e9e9e',
      })
      .setOrigin(0.5);

    // equipment grid
    EQUIPMENTS.forEach((eq, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 70 + col * 80;
      const y = 480 + row * 60;
      const got = data.collected.includes(eq.id);
      const icon = this.add.image(x, y, `eq-icon-${eq.id}`).setAlpha(got ? 1 : 0.25);
      applyDisplayBox(icon, layout.hudIconSize * 1.35);
      if (got) {
        const sx = icon.scaleX;
        const sy = icon.scaleY;
        this.tweens.add({
          targets: icon,
          scaleX: sx * 1.12,
          scaleY: sy * 1.12,
          duration: 400,
          yoyo: true,
          repeat: -1,
          delay: i * 80,
        });
      }
    });
    if (data.love) {
      const love = this.add.image(W / 2 + 120, 540, 'love');
      applyDisplayBox(love, layout.worldLoveSize);
      this.add
        .text(W / 2 + 120, 575, 'Amour', {
          fontFamily: 'Outfit',
          fontSize: '11px',
          color: '#ff80ab',
        })
        .setOrigin(0.5);
    }

    this.btn(W / 2, 660, 'PARTAGER MON RÉSULTAT', async () => {
      audio.ui();
      const text = formatShareText({
        won: true,
        equipment: data.equipment,
        love: data.love,
        distance: data.distance,
      });
      const r = await shareResult(text);
      if (r === 'copied') this.feedback('Résultat copié !');
      else if (r === 'shared') this.feedback('Partagé !');
      else if (r === 'cancelled') this.feedback('Partage annulé');
    });

    this.btn(W / 2, 720, 'REJOUER', () => {
      audio.ui();
      this.scene.start('Game');
    }, 0x2a1050);

    this.btn(W / 2, 775, 'ACCUEIL', () => {
      audio.ui();
      this.scene.start('Menu');
    }, 0x1a0a30);
  }

  private btn(x: number, y: number, label: string, cb: () => void, color = 0x9b59ff): void {
    const bg = this.add
      .rectangle(x, y, 280, 42, color)
      .setStrokeStyle(2, 0xff2d95)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, { fontFamily: 'Outfit', fontSize: '14px', color: '#fff', fontStyle: 'bold' })
      .setOrigin(0.5);
    bg.on('pointerdown', cb);
  }

  private feedback(msg: string): void {
    const t = this.add
      .text(this.scale.width / 2, this.scale.height / 2, msg, {
        fontFamily: 'Outfit',
        fontSize: '16px',
        color: '#00e5ff',
        backgroundColor: '#000000aa',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(100);
    this.tweens.add({
      targets: t,
      alpha: 0,
      duration: 1200,
      delay: 600,
      onComplete: () => t.destroy(),
    });
  }
}
