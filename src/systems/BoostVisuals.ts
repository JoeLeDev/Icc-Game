import type Phaser from 'phaser';

/** Bounded procedural exhaust: no timers, textures or independent animation loop. */
export class BoostVisuals {
  readonly graphics: Phaser.GameObjects.Graphics;
  private phase = 0;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setVisible(false);
  }

  update(dt: number, active: boolean, reduced: boolean, width: number, height: number): void {
    this.graphics.setVisible(active);
    if (!active) { this.phase = 0; return; }
    this.phase += reduced ? 0 : dt;
    const g = this.graphics.clear();
    const pulse = reduced ? 1 : 1 + Math.sin(this.phase * 22) * .1;
    const start = height * .25;
    const length = height * (reduced ? .32 : .85) * pulse;
    for (const side of [-1, 1]) {
      const x = side * width * .28;
      g.fillStyle(0xb62dff, reduced ? .3 : .22);
      g.fillTriangle(x - width * .16, start, x + width * .16, start, x, start + length);
      g.fillStyle(0x00e5ff, .7);
      g.fillTriangle(x - width * .07, start, x + width * .07, start, x, start + length * .78);
      g.fillStyle(0xe5fcff, .95);
      g.fillTriangle(x - width * .025, start, x + width * .025, start, x, start + length * .48);
    }
    if (reduced) return;
    // Six short road streaks: fixed geometry budget, aligned with the moving bike.
    for (let i = 0; i < 6; i++) {
      const progress = (this.phase * 2 + i / 6) % 1;
      const side = i % 2 ? 1 : -1;
      const x = side * width * (.65 + (i % 3) * .15);
      const y = -height * .2 + progress * height;
      g.lineStyle(2, i % 2 ? 0xff43bc : 0x00e5ff, Math.sin(progress * Math.PI) * .55);
      g.lineBetween(x, y, x + side * width * .06, y + height * .22);
    }
  }
}
