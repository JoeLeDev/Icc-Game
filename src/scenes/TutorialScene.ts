import Phaser from 'phaser';
import { EQUIPMENTS, GAME_H, GAME_W } from '../config/gameConfig';
import { audio } from '../utils/AudioManager';

export class TutorialScene extends Phaser.Scene {
  constructor() {
    super('Tutorial');
  }

  create(): void {
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x070412, 0.96);

    this.add
      .text(GAME_W / 2, 70, 'COMMENT JOUER ?', {
        fontFamily: 'Orbitron',
        fontSize: '22px',
        color: '#ff2d95',
      })
      .setOrigin(0.5);

    // swipe illustration
    this.add.rectangle(GAME_W / 2, 160, 70, 120, 0x1a0a30).setStrokeStyle(2, 0xe040fb);
    const hand = this.add.text(GAME_W / 2, 170, '👆', { fontSize: '28px' }).setOrigin(0.5);
    this.tweens.add({
      targets: hand,
      x: GAME_W / 2 + 40,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const tips = [
      'Swipe ← → ou flèches / A D pour changer de voie',
      'Récupère les 7 équipements d\'Éphésiens 6',
      'Évite véhicules, explosifs et attaques',
      'L\'Amour ❤ est un joker rare et puissant',
      'Plus tu t\'équipes, plus la route s\'intensifie',
    ];

    tips.forEach((t, i) => {
      this.add
        .text(GAME_W / 2, 250 + i * 48, t, {
          fontFamily: 'Outfit',
          fontSize: '14px',
          color: '#e1bee7',
          align: 'center',
          wordWrap: { width: 320 },
        })
        .setOrigin(0.5);
    });

    // equipment preview row
    EQUIPMENTS.forEach((eq, i) => {
      this.add.image(40 + i * 48, GAME_H - 160, `eq-icon-${eq.id}`).setScale(1.1);
    });
    this.add.image(GAME_W - 40, GAME_H - 160, 'love').setScale(0.7);

    this.add
      .text(GAME_W / 2, GAME_H - 120, 'Objectif : survivre jusqu\'à la conquête finale', {
        fontFamily: 'Outfit',
        fontSize: '12px',
        color: '#9b59ff',
      })
      .setOrigin(0.5);

    const play = this.add
      .rectangle(GAME_W / 2, GAME_H - 60, 200, 48, 0x9b59ff)
      .setStrokeStyle(2, 0xff2d95)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(GAME_W / 2, GAME_H - 60, 'JOUER', {
        fontFamily: 'Orbitron',
        fontSize: '18px',
        color: '#fff',
      })
      .setOrigin(0.5);
    play.on('pointerdown', () => {
      audio.ui();
      this.scene.start('Game');
    });

    const back = this.add
      .text(40, 40, '←', { fontSize: '28px', color: '#fff' })
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      audio.ui();
      this.scene.start('Menu');
    });
  }
}
