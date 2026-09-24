import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config/gameConfig';
import { fitTextureScale, textureKey } from './AssetFactory';
import { DEPTH, RoadProjection } from './RoadProjection';

interface SideProp {
  side: -1 | 1;
  z: number;
  sprite: Phaser.GameObjects.Image;
  fit: number;
}

/**
 * Décor urbain en perspective : ciel, skyline, route trapèze, bas-côtés parallaxe.
 */
export class WorldView {
  readonly proj = new RoadProjection();
  private roadGfx!: Phaser.GameObjects.Graphics;
  private dashOffset = 0;
  private cityFar!: Phaser.GameObjects.Container;
  private cityNear!: Phaser.GameObjects.Container;
  private props: SideProp[] = [];
  private speedLines!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {}

  create(): void {
    this.drawSky();
    this.cityFar = this.buildSkyline(0.55, DEPTH.cityFar);
    this.cityNear = this.buildSkyline(0.9, DEPTH.cityNear);
    this.ground = this.scene.add.graphics().setDepth(DEPTH.road - 1);
    this.roadGfx = this.scene.add.graphics().setDepth(DEPTH.road);
    this.speedLines = this.scene.add.graphics().setDepth(DEPTH.fx - 5).setAlpha(0);
    this.seedProps();
    this.redrawRoad(0);
  }

  destroy(): void {
    this.props.forEach((p) => p.sprite.destroy());
    this.props = [];
  }

  update(dt: number, scrollSpeed: number, boosting: boolean): void {
    const worldDelta = scrollSpeed * dt;
    this.dashOffset = (this.dashOffset + worldDelta * 0.45) % 48;
    this.cityFar.x = Math.sin(this.dashOffset * 0.002) * 6;
    this.cityNear.x = Math.sin(this.dashOffset * 0.004) * 12;
    this.redrawRoad(this.dashOffset);
    this.updateProps(worldDelta);
    this.updateSpeedLines(boosting, scrollSpeed);
  }

  private drawSky(): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.sky);
    g.fillGradientStyle(0x1a0535, 0x1a0535, 0xff6b8a, 0x4a1a6e, 1);
    g.fillRect(0, 0, GAME_W, this.proj.horizonY + 40);
    g.fillStyle(0x0a0618, 1);
    g.fillRect(0, this.proj.horizonY + 30, GAME_W, GAME_H);
    g.fillStyle(0xff2d95, 0.12);
    g.fillEllipse(GAME_W / 2, this.proj.horizonY + 10, GAME_W * 0.9, 50);
    g.fillStyle(0x00e5ff, 0.06);
    g.fillEllipse(GAME_W / 2, this.proj.horizonY + 4, GAME_W * 0.5, 28);
  }

  private buildSkyline(scale: number, depth: number): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0).setDepth(depth);

    if (this.scene.textures.exists('skyline')) {
      const img = this.scene.add
        .image(GAME_W / 2, this.proj.horizonY + 4, 'skyline')
        .setOrigin(0.5, 1)
        .setAlpha(0.55 + scale * 0.35);
      const targetH = 70 + scale * 90;
      const fit = fitTextureScale(this.scene, 'skyline', targetH);
      img.setScale(fit * (0.85 + scale * 0.2));
      c.add(img);
      if (scale > 0.7) {
        const img2 = this.scene.add
          .image(GAME_W / 2 + 40, this.proj.horizonY + 4, 'skyline')
          .setOrigin(0.5, 1)
          .setAlpha(0.25)
          .setScale(img.scaleX * 0.92);
        c.add(img2);
      }
      return c;
    }

    const baseY = this.proj.horizonY + 8;
    let x = -20;
    while (x < GAME_W + 40) {
      const w = Phaser.Math.Between(16, 34) * scale;
      const h = Phaser.Math.Between(36, 110) * scale;
      const col = Phaser.Math.RND.pick([0x0d0620, 0x12082a, 0x1a0f38, 0x160a2e]);
      c.add(this.scene.add.rectangle(x + w / 2, baseY - h / 2, w, h, col, 0.95));
      const rows = Math.floor(h / 14);
      for (let r = 0; r < rows; r++) {
        if (Math.random() > 0.45) {
          c.add(
            this.scene.add.rectangle(
              x + Phaser.Math.Between(4, Math.max(5, w - 8)),
              baseY - h + 8 + r * 12,
              3,
              4,
              Phaser.Math.RND.pick([0xff2d95, 0x00e5ff, 0xffd54f, 0x9b59ff]),
              Phaser.Math.FloatBetween(0.35, 0.8),
            ),
          );
        }
      }
      x += w + Phaser.Math.Between(4, 14);
    }
    return c;
  }

  private seedProps(): void {
    for (let i = 0; i < 10; i++) {
      this.spawnProp(-1, 40 + i * 55);
      this.spawnProp(1, 60 + i * 55);
    }
  }

  private spawnProp(side: -1 | 1, z: number): void {
    const kinds = ['prop-lamp', 'prop-palm', 'prop-building'] as const;
    const kind = Phaser.Math.RND.pick([...kinds]);
    const key = textureKey(kind, this.scene);
    const sprite = this.scene.add.image(0, 0, key).setDepth(DEPTH.roadsideNear);
    const fit = fitTextureScale(this.scene, key, kind === 'prop-palm' ? 140 : 120);
    const p: SideProp = { side, z, sprite, fit };
    this.props.push(p);
    this.layoutProp(p);
  }

  private layoutProp(p: SideProp): void {
    const t = this.proj.depthT(p.z);
    const half = this.proj.roadHalfAt(p.z);
    const margin = Phaser.Math.Linear(30, 8, t);
    const x = this.proj.centerX + p.side * (half + margin);
    const y = this.proj.project(1, p.z).y;
    const scale = Phaser.Math.Linear(1.25, 0.22, t) * p.fit;
    p.sprite.setPosition(x, y);
    p.sprite.setScale(scale);
    p.sprite.setDepth(p.z < 90 ? DEPTH.roadsideNear : DEPTH.roadsideFar);
    p.sprite.setAlpha(0.5 + (1 - t) * 0.5);
  }


  private updateProps(worldDelta: number): void {
    for (const p of this.props) {
      p.z -= worldDelta;
      if (p.z < -20) p.z += this.proj.maxZ + Phaser.Math.Between(20, 80);
      this.layoutProp(p);
    }
  }

  private redrawRoad(dashOffset: number): void {
    const g = this.roadGfx;
    g.clear();
    this.ground.clear();

    const top = this.proj.horizonY;
    const bot = GAME_H + 10;
    const far = this.proj.farRoadHalf;
    const near = this.proj.nearRoadHalf;
    const cx = this.proj.centerX;

    this.ground.fillStyle(0x12081f, 1);
    this.ground.fillRect(0, top, GAME_W, bot - top);

    g.fillStyle(0x14101f, 1);
    g.beginPath();
    g.moveTo(cx - far, top);
    g.lineTo(cx + far, top);
    g.lineTo(cx + near, bot);
    g.lineTo(cx - near, bot);
    g.closePath();
    g.fillPath();

    g.lineStyle(3, 0x9b59ff, 0.75);
    g.lineBetween(cx - far, top, cx - near, bot);
    g.lineStyle(3, 0xff2d95, 0.75);
    g.lineBetween(cx + far, top, cx + near, bot);

    for (const laneDiv of [-0.5, 0.5] as const) {
      this.drawDashedLane(g, laneDiv, dashOffset);
    }

    g.fillStyle(0x00e5ff, 0.04);
    g.fillTriangle(cx, top + 8, cx - 10, bot, cx + 10, bot);
  }

  private drawDashedLane(g: Phaser.GameObjects.Graphics, laneDiv: number, dashOffset: number): void {
    const steps = 18;
    for (let i = 0; i < steps; i++) {
      const phase = (i / steps) * this.proj.maxZ;
      const z0 = (phase + dashOffset * 2.2) % this.proj.maxZ;
      const z1 = z0 + 14;
      if (z1 > this.proj.maxZ) continue;
      const y0 = this.proj.project(1, z0).y;
      const y1 = this.proj.project(1, z1).y;
      const x0 = this.proj.centerX + laneDiv * this.proj.laneSpacingAt(z0);
      const x1 = this.proj.centerX + laneDiv * this.proj.laneSpacingAt(z1);
      const alpha = 0.25 + (1 - this.proj.depthT(z0)) * 0.55;
      g.lineStyle(Math.max(1, 2 * (1 - this.proj.depthT(z0))), 0xff2d95, alpha);
      g.lineBetween(x0, y0, x1, y1);
    }
  }

  private updateSpeedLines(boosting: boolean, scrollSpeed: number): void {
    const intensity = Math.min(1, (scrollSpeed - 200) / 360) * (boosting ? 1.2 : 0.65);
    this.speedLines.clear();
    if (intensity < 0.15) {
      this.speedLines.setAlpha(0);
      return;
    }
    this.speedLines.setAlpha(0.12 + intensity * 0.28);
    this.speedLines.lineStyle(1.5, 0x00e5ff, 0.45);
    for (let i = 0; i < 7; i++) {
      const x = Phaser.Math.Between(24, GAME_W - 24);
      const y1 = Phaser.Math.Between(this.proj.horizonY + 50, GAME_H - 140);
      this.speedLines.lineBetween(x, y1, x, y1 + 10 + intensity * 36);
    }
  }
}
