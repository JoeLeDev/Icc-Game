import Phaser from 'phaser';
import { generateTextures } from '../systems/AssetFactory';
import { GAME_H, GAME_W } from '../config/gameConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateTextures(this);

    // loading splash
    const g = this.add.graphics();
    g.fillGradientStyle(0x120828, 0x120828, 0x2a1050, 0x1a0a40, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    this.add
      .text(GAME_W / 2, GAME_H / 2 - 20, 'KHAYIL 2026', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '28px',
        color: '#ff2d95',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_W / 2, GAME_H / 2 + 20, 'Chargement…', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '14px',
        color: '#ce93d8',
      })
      .setOrigin(0.5);

    this.time.delayedCall(400, () => this.scene.start('Menu'));
  }
}
