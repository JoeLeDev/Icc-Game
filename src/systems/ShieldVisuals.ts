import type Phaser from 'phaser';

/** Persistent green armor, distinct from cyan invincibility and boost exhaust. */
export class ShieldVisuals {
  readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setVisible(false);
  }

  update(active: boolean, reduced: boolean, time: number, width: number, height: number): void {
    const g = this.graphics;
    g.setVisible(active);
    if (!active) return;
    g.clear();
    const pulse = reduced ? 1 : 1 + Math.sin(time * 3) * .025;
    const x = width * .75 * pulse;
    const y = height * .62 * pulse;
    const shell = [
      { x: 0, y: -y }, { x, y: -y * .6 }, { x, y: y * .55 },
      { x: 0, y }, { x: -x, y: y * .55 }, { x: -x, y: -y * .6 },
    ];
    g.fillStyle(0x69f0ae, .09);
    g.fillPoints(shell, true);
    g.lineStyle(10, 0x26ef95, .16);
    g.strokePoints(shell, true);
    g.lineStyle(3, 0x69f0ae, .95);
    g.strokePoints(shell, true);
    // Bright shield badge above the rider: readable even on a green backdrop.
    const size = Math.max(7, width * .13);
    const badge = [
      { x: -size, y: -y - size }, { x: size, y: -y - size },
      { x: size * .8, y: -y + size * .25 }, { x: 0, y: -y + size },
      { x: -size * .8, y: -y + size * .25 },
    ];
    g.fillStyle(0x09281d, 1);
    g.fillPoints(badge, true);
    g.lineStyle(2, 0xb9ffdc, 1);
    g.strokePoints(badge, true);
  }
}
