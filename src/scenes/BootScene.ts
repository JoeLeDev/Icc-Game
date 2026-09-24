import Phaser from 'phaser';
import { generateTextures, tryLoadExternalAssets } from '../systems/AssetFactory';
import { computeLayout, readSafeAreaInsets, setCurrentLayout } from '../config/responsiveLayout';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    setCurrentLayout(computeLayout(W, H, readSafeAreaInsets()));

    generateTextures(this);

    const g = this.add.graphics();
    g.fillGradientStyle(0x120828, 0x120828, 0x2a1050, 0x1a0a40, 1);
    g.fillRect(0, 0, W, H);

    this.add
      .text(W / 2, H / 2 - 20, 'KHAYIL 2026', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '28px',
        color: '#ff2d95',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H / 2 + 20, 'Chargement…', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '14px',
        color: '#ce93d8',
      })
      .setOrigin(0.5);

    void tryLoadExternalAssets(this).then((loaded) => {
      if (import.meta.env.DEV && loaded.length) {
        console.info(`[Khayil] ${loaded.length} assets PNG chargés`, loaded);
      }
    }).finally(() => {
      this.time.delayedCall(200, () => this.scene.start('Menu'));
    });
  }
}
