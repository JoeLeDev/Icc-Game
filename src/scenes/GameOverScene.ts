import Phaser from 'phaser';
import type { EquipmentId } from '../config/gameConfig';
import { computeLayout, readSafeAreaInsets, setCurrentLayout } from '../config/responsiveLayout';
import { applyDisplayWidth } from '../systems/SpriteDisplay';
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
  doubts?: number;
  score?: number;
  grade?: string;
  gradeLabel?: string;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: EndData): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const layout = computeLayout(W, H, readSafeAreaInsets());
    setCurrentLayout(layout);

    this.add.rectangle(0, 0, W, H, 0x0a0618, 1).setOrigin(0);

    const moto = this.add.image(W / 2, 280, 'player').setAngle(15).setAlpha(0.7).setTint(0x666688);
    applyDisplayWidth(moto, layout.gameOverPlayerWidth, layout.playerDisplayHeightMax * 1.2);

    this.add
      .text(W / 2, 380, 'GAME OVER', {
        fontFamily: 'Orbitron',
        fontSize: '32px',
        color: '#ff2d95',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, 430, 'Relève-toi. Tu es appelée à conquérir.', {
        fontFamily: 'Outfit',
        fontSize: '14px',
        color: '#e1bee7',
        align: 'center',
        wordWrap: { width: 300 },
      })
      .setOrigin(0.5);

    this.add
      .text(
        W / 2,
        465,
        `Note ${data.grade ?? '—'} — ${data.gradeLabel ?? ''}  ·  ${data.score ?? 0} pts`,
        { fontFamily: 'Orbitron', fontSize: '15px', color: '#ffd54f' },
      )
      .setOrigin(0.5);

    this.add
      .text(
        W / 2,
        500,
        `${data.equipment}/7 équipements  ·  ${data.distance} m${data.love ? '  ·  Amour ❤' : ''}`,
        { fontFamily: 'Outfit', fontSize: '13px', color: '#9b59ff' },
      )
      .setOrigin(0.5);

    this.add
      .text(
        W / 2,
        525,
        `${data.avoided ?? 0} esquivés  ·  ${data.doubts ?? 0} doutes`,
        { fontFamily: 'Outfit', fontSize: '12px', color: '#b39ddb' },
      )
      .setOrigin(0.5);

    const best = Storage.getBestDistance();
    this.add
      .text(W / 2, 550, `Record local : ${best} m`, {
        fontFamily: 'Outfit',
        fontSize: '12px',
        color: '#757575',
      })
      .setOrigin(0.5);

    this.btn(W / 2, 610, 'RÉESSAYER', () => {
      audio.ui();
      this.scene.start('Game');
    });

    this.btn(W / 2, 670, 'PARTAGER', async () => {
      audio.ui();
      const r = await shareResult(
        formatShareText({
          won: false,
          equipment: data.equipment,
          love: data.love,
          distance: data.distance,
        }),
      );
      if (r === 'copied') this.feedback('Résultat copié !');
      else if (r === 'cancelled') this.feedback('Partage annulé');
    }, 0x2a1050);

    this.btn(W / 2, 730, 'RETOUR À L\'ACCUEIL', () => {
      audio.ui();
      this.scene.start('Menu');
    }, 0x1a0a30);
  }

  private btn(x: number, y: number, label: string, cb: () => void, color = 0x9b59ff): void {
    const bg = this.add
      .rectangle(x, y, 280, 44, color)
      .setStrokeStyle(2, 0xff2d95)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, { fontFamily: 'Outfit', fontSize: '15px', color: '#fff', fontStyle: 'bold' })
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
      .setOrigin(0.5);
    this.tweens.add({
      targets: t,
      alpha: 0,
      duration: 1200,
      delay: 600,
      onComplete: () => t.destroy(),
    });
  }
}
