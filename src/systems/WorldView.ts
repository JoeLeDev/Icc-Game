import Phaser from 'phaser';
import { ROADSIDE_BUILDING_KEYS } from '../config/displaySizes';
import type { LayoutMetrics } from '../config/responsiveLayout';
import { getCurrentLayout } from '../config/responsiveLayout';
import {
  type PlannedDecor,
  type RoadsideBand,
  type RoadsidePropDefinition,
  planNextAfter,
  planRoadsideDecor,
} from '../config/roadsideDecor';
import {
  type RoadsidePhase,
  roadsidePhase,
  roadsideScrollMul,
} from '../config/roadsideLifecycle';
import { buildingDisplayHeight, propDisplayHeight } from '../config/roadsideScale';
import { fitTextureScale, textureKey } from './AssetFactory';
import { DEPTH, RoadProjection } from './RoadProjection';

interface RoadsideItem {
  side: -1 | 1;
  z: number;
  def: RoadsidePropDefinition;
  scaleMul: number;
  band: RoadsideBand;
  sprite: Phaser.GameObjects.Image;
}

interface CityMidItem {
  side: -1 | 1;
  z: number;
  scaleMul: number;
  logicalKey: string;
  sprite: Phaser.GameObjects.Image;
}

/**
 * Couches :
 * FAR  — ciel / skyline / Building.png (bande horizon, non étirée)
 * MID  — silhouettes bâtiments (continuité horizon → roadside)
 * NEAR — roadside FAR buildings + NEAR palms/lamps
 * GAME — route 640 px
 */
export class WorldView {
  readonly proj = new RoadProjection();
  private layout: LayoutMetrics = getCurrentLayout();
  private skyGfx!: Phaser.GameObjects.Graphics;
  private ambientGfx!: Phaser.GameObjects.Graphics;
  private roadGfx!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Graphics;
  private speedLines!: Phaser.GameObjects.Graphics;
  private dashOffset = 0;

  private bgRoot!: Phaser.GameObjects.Container;
  private bgSprites: Phaser.GameObjects.Image[] = [];
  private cityMid: CityMidItem[] = [];
  private roadside: RoadsideItem[] = [];
  private debugEnabled = false;
  private debugGfx: Phaser.GameObjects.Graphics | null = null;
  private debugLabels: Phaser.GameObjects.Text[] = [];

  constructor(private scene: Phaser.Scene) {}

  create(): void {
    this.layout = getCurrentLayout();
    this.proj.applyLayout(this.layout);

    this.skyGfx = this.scene.add.graphics().setDepth(DEPTH.bgSky);
    this.ambientGfx = this.scene.add.graphics().setDepth(DEPTH.bgAmbient);
    this.bgRoot = this.scene.add.container(0, 0).setDepth(DEPTH.bgCity);
    this.ground = this.scene.add.graphics().setDepth(DEPTH.ground);
    this.roadGfx = this.scene.add.graphics().setDepth(DEPTH.road);
    this.speedLines = this.scene.add.graphics().setDepth(DEPTH.fx - 5).setAlpha(0);

    this.rebuildGlobalBackground();
    this.seedCityMid();
    this.seedRoadside();
    this.redrawRoad(0);
  }

  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
    if (!enabled) this.clearDebugDraw();
    else if (!this.debugGfx) {
      this.debugGfx = this.scene.add.graphics().setDepth(DEPTH.hud + 40);
    }
  }

  applyLayout(layout: LayoutMetrics): void {
    this.layout = layout;
    this.proj.applyLayout(layout);
    this.rebuildGlobalBackground();
    for (const m of this.cityMid) this.layoutCityMid(m);
    for (const item of this.roadside) this.layoutRoadsideItem(item);
    this.redrawRoad(this.dashOffset);
  }

  destroy(): void {
    this.clearBgSprites();
    this.clearDebugDraw();
    this.cityMid.forEach((m) => m.sprite.destroy());
    this.roadside.forEach((i) => i.sprite.destroy());
    this.cityMid = [];
    this.roadside = [];
  }

  update(_dt: number, scrollSpeed: number, boosting: boolean): void {
    const worldDelta = scrollSpeed * _dt;
    this.dashOffset = (this.dashOffset + worldDelta * 0.45) % 48;
    this.redrawRoad(this.dashOffset);
    this.updateCityMid(worldDelta);
    this.updateRoadside(worldDelta);
    this.updateSpeedLines(boosting, scrollSpeed);
    this.parallaxBackground();
    if (this.debugEnabled) this.drawRoadsideDebug();
  }

  private get BW(): number {
    return this.layout.browserWidth;
  }

  private get BH(): number {
    return this.layout.browserHeight;
  }

  private clearBgSprites(): void {
    for (const s of this.bgSprites) s.destroy();
    this.bgSprites = [];
    this.bgRoot.removeAll(true);
  }

  /**
   * FAR — skyline + Building.png en bande horizon (pas d’étirement vertical).
   */
  private rebuildGlobalBackground(): void {
    this.clearBgSprites();
    this.drawSkyAndAmbient();

    const skyline = this.resolveTex('skyline');
    const city = this.resolveTex('bg-panorama') ?? this.resolveTex('dressing-city');

    if (skyline) this.tileSkyline(skyline);
    if (city) this.tileCityBackdrop(city);
  }

  private resolveTex(base: string): string | null {
    if (this.scene.textures.exists(base)) return base;
    if (this.scene.textures.exists(base + '_ext')) return base + '_ext';
    return null;
  }

  private drawSkyAndAmbient(): void {
    const g = this.skyGfx;
    g.clear();
    const hy = this.proj.horizonY;

    g.fillGradientStyle(0x1a0535, 0x1a0535, 0xff6b8a, 0x4a1a6e, 1);
    g.fillRect(0, 0, this.BW, hy + 48);

    g.fillStyle(0x0e071c, 1);
    g.fillRect(0, hy + 36, this.BW, this.BH);

    const glowW = Math.max(this.layout.gameWidth * 1.4, this.BW * 0.55);
    g.fillStyle(0xff2d95, 0.11);
    g.fillEllipse(this.layout.centerX, hy + 8, glowW, 56);
    g.fillStyle(0x00e5ff, 0.055);
    g.fillEllipse(this.layout.centerX, hy + 2, glowW * 0.55, 32);

    const a = this.ambientGfx;
    a.clear();
    const count = Math.max(6, Math.floor(this.BW / 180));
    for (let i = 0; i < count; i++) {
      const x = (this.BW / (count + 1)) * (i + 1);
      const y = hy - 20 - (i % 3) * 18;
      a.fillStyle(i % 2 === 0 ? 0xff2d95 : 0x00e5ff, 0.07 + (i % 3) * 0.02);
      a.fillCircle(x, y, 10 + (i % 4) * 4);
    }
  }

  private tileSkyline(texKey: string): void {
    const hy = this.proj.horizonY + 4;
    const targetH = Math.min(150, this.BH * 0.2);
    const fit = fitTextureScale(this.scene, texKey, targetH);
    const probe = this.scene.textures.get(texKey).get();
    const tileW = probe.width * fit;
    const tiles = Math.ceil(this.BW / Math.max(tileW * 0.85, 1)) + 2;
    const startX = this.layout.centerX - ((tiles - 1) * tileW * 0.85) / 2;

    for (let i = 0; i < tiles; i++) {
      const img = this.scene.add
        .image(startX + i * tileW * 0.85, hy, texKey)
        .setOrigin(0.5, 1)
        .setScale(fit)
        .setAlpha(0.55);
      img.setData('baseX', img.x);
      img.setData('parallax', 0.12);
      this.bgRoot.add(img);
      this.bgSprites.push(img);
    }
  }

  /**
   * Building.png = bande FAR horizontale (temporaire).
   * Ne pas étirer verticalement — la continuité vient de CITY MID.
   */
  private tileCityBackdrop(texKey: string): void {
    const hy = this.proj.horizonY + 8;
    // Bande basse volontaire — pas de fill vertical du vide
    const targetH = Math.min(this.BH * 0.26, 210);
    const probe = this.scene.textures.get(texKey).get();
    const scale = targetH / Math.max(1, probe.height);
    const tileW = probe.width * scale;
    const overlap = 0.8;
    const tiles = Math.ceil(this.BW / Math.max(tileW * overlap, 1)) + 2;
    const startX = this.layout.centerX - ((tiles - 1) * tileW * overlap) / 2;

    for (let i = 0; i < tiles; i++) {
      const img = this.scene.add.image(startX + i * tileW * overlap, hy, texKey);
      img.setOrigin(0.5, 1);
      img.setScale(scale);
      img.setFlipX(i % 2 === 1);
      img.setAlpha(0.38);
      img.setTint(0xb8a8d0);
      img.setData('baseX', img.x);
      img.setData('parallax', 0.18);
      this.bgRoot.add(img);
      this.bgSprites.push(img);
    }
  }

  private parallaxBackground(): void {
    const drift = Math.sin(this.dashOffset * 0.0025) * 5;
    for (const img of this.bgSprites) {
      const baseX = img.getData('baseX') as number;
      const p = (img.getData('parallax') as number) || 0.2;
      img.x = baseX + drift * p;
    }
  }

  // ——— CITY MID : silhouettes entre horizon et roadside ———

  private seedCityMid(): void {
    for (const m of this.cityMid) m.sprite.destroy();
    this.cityMid = [];
    const keys = [...ROADSIDE_BUILDING_KEYS];
    for (const side of [-1, 1] as const) {
      const phase = side < 0 ? 0 : 22;
      for (let i = 0; i < 10; i++) {
        const z = 195 + phase + i * 26;
        const logicalKey = keys[i % keys.length]!;
        const tex = textureKey(logicalKey, this.scene);
        const sprite = this.scene.add.image(0, 0, tex).setOrigin(0.5, 1);
        sprite.setFlipX(side > 0 || i % 3 === 0);
        sprite.setTint(0x5a3d7a);
        const item: CityMidItem = {
          side,
          z,
          scaleMul: 0.72 + (i % 4) * 0.06,
          logicalKey,
          sprite,
        };
        this.cityMid.push(item);
        this.layoutCityMid(item);
      }
    }
  }

  private layoutCityMid(m: CityMidItem): void {
    const t = this.proj.depthT(m.z);
    const half = this.proj.roadHalfAt(m.z);
    const y = this.proj.project(1, m.z).y;
    const nearH = this.layout.buildingNearHeight * 0.42;
    const farH = this.layout.buildingFarHeight * 1.15;
    const h = buildingDisplayHeight(m.z, this.proj.maxZ, nearH, farH) * m.scaleMul;
    const aspect = m.sprite.frame.width / Math.max(1, m.sprite.frame.height);
    const w = h * aspect;
    m.sprite.setDisplaySize(w, h);

    // Plus loin que les roadside FAR — converge vers le même centre
    const lateral = half + half * 0.95 + w * 0.38 + 12;
    let x = this.proj.centerX + m.side * lateral;
    const roadEdge = this.proj.centerX + m.side * (half + 6);
    if (m.side < 0) x = Math.min(x, roadEdge - 4);
    else x = Math.max(x, roadEdge + 4);

    m.sprite.setPosition(x, y);
    m.sprite.setAlpha(0.22 + (1 - t) * 0.18);
    m.sprite.setDepth(DEPTH.cityMid + (1 - t) * 0.4);
  }

  private updateCityMid(worldDelta: number): void {
    for (const m of this.cityMid) {
      // Parallax lent — couche continue, ne disparaît pas au passage joueur
      m.z -= worldDelta * 0.55;
      if (m.z < 160) {
        m.z += 260 + Math.random() * 40;
        const keys = [...ROADSIDE_BUILDING_KEYS];
        m.logicalKey = keys[Math.floor(Math.random() * keys.length)]!;
        m.sprite.setTexture(textureKey(m.logicalKey, this.scene));
        m.sprite.setFlipX(m.side > 0 || Math.random() < 0.3);
        m.sprite.setTint(0x5a3d7a);
        m.scaleMul = 0.7 + Math.random() * 0.25;
      }
      this.layoutCityMid(m);
    }
  }

  // ——— ROADSIDE FAR / NEAR ———

  private seedRoadside(): void {
    for (const item of this.roadside) item.sprite.destroy();
    this.roadside = [];
    const plan = planRoadsideDecor(this.proj.maxZ);
    for (const p of plan) this.spawnFromPlan(p);
  }

  private spawnFromPlan(p: PlannedDecor): RoadsideItem {
    const key = textureKey(p.def.key, this.scene);
    const sprite = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
    if (p.def.category === 'building') {
      sprite.setFlipX(p.side > 0 || Math.random() < 0.2);
    }
    const item: RoadsideItem = {
      side: p.side,
      z: p.z,
      def: p.def,
      scaleMul: p.scaleMul,
      band: p.band,
      sprite,
    };
    this.roadside.push(item);
    this.layoutRoadsideItem(item);
    return item;
  }

  private layoutRoadsideItem(item: RoadsideItem): void {
    const maxZ = this.proj.maxZ;
    const phase = roadsidePhase(item.z, maxZ);
    const decor = this.proj.projectDecor(item.z);
    const half = decor.roadHalf;
    const y = decor.y;
    const aspect = item.sprite.frame.width / Math.max(1, item.sprite.frame.height);

    let displayH: number;
    if (item.def.category === 'building') {
      displayH =
        buildingDisplayHeight(
          item.z,
          maxZ,
          this.layout.buildingNearHeight,
          this.layout.buildingFarHeight,
        ) * item.scaleMul;
    } else {
      const near =
        item.def.category === 'palm' ? this.layout.propPalmHeight : this.layout.propLampHeight;
      const far = near * 0.22;
      displayH = propDisplayHeight(item.z, maxZ, near, far) * item.scaleMul;
    }
    const displayW = displayH * aspect;
    item.sprite.setDisplaySize(displayW, displayH);

    // Perspective naturelle uniquement — PAS de push outward en PASSED
    const roadPad = 8;
    let curb: number;
    let anchorOut: number;
    if (item.band === 'far') {
      curb = half * this.layout.buildingLateralFactor + this.layout.buildingMargin;
      anchorOut = displayW * 0.4;
    } else {
      curb = half * this.layout.propLateralFactor + roadPad;
      anchorOut = displayW * 0.2;
    }

    let x = this.proj.centerX + item.side * (half + curb + anchorOut);

    const roadEdge = this.proj.centerX + item.side * (half + roadPad);
    if (item.side < 0) {
      x = Math.min(x, roadEdge - 2);
    } else {
      x = Math.max(x, roadEdge + 2);
    }

    item.sprite.setPosition(x, y);
    const approachT = Math.min(1, Math.max(0, item.z / maxZ));
    item.sprite.setAlpha(phase === 'PASSED' ? 0.95 : 0.72 + (1 - approachT) * 0.28);

    const nearness =
      phase === 'PASSED' ? 1 + Math.min(0.5, decor.exitT) * 0.15 : 1 - approachT;
    if (item.band === 'far') {
      item.sprite.setDepth(DEPTH.roadsideBuildings + nearness * 0.95);
    } else {
      item.sprite.setDepth(DEPTH.roadsideProps + nearness * 0.95);
    }
  }

  private updateRoadside(worldDelta: number): void {
    for (const item of this.roadside) {
      const phase = roadsidePhase(item.z, this.proj.maxZ);
      item.z -= worldDelta * roadsideScrollMul(phase, item.band);
      this.layoutRoadsideItem(item);

      if (item.z <= 0) {
        const b = item.sprite.getBounds();
        // Sortie principale = bas (bounds.top sous le viewport)
        const pastBottom = b.top > this.BH + 56;
        if (pastBottom || item.z < -280) {
          this.recycleRoadsideItem(item);
          this.layoutRoadsideItem(item);
        }
      }
    }
  }

  private recycleRoadsideItem(item: RoadsideItem): void {
    const others: PlannedDecor[] = this.roadside
      .filter((r) => r !== item)
      .map((r) => ({
        side: r.side,
        z: r.z,
        def: r.def,
        scaleMul: r.scaleMul,
        band: r.band,
      }));
    const next = planNextAfter(item.side, others, item.def.category, Math.random, this.proj.maxZ);

    item.z = next.z;
    item.def = next.def;
    item.scaleMul = next.scaleMul;
    item.band = next.band;

    item.sprite.setTexture(textureKey(item.def.key, this.scene));
    if (item.def.category === 'building') {
      item.sprite.setFlipX(item.side > 0 || Math.random() < 0.2);
      item.sprite.clearTint();
    } else {
      item.sprite.setFlipX(false);
      item.sprite.clearTint();
    }
  }

  private clearDebugDraw(): void {
    this.debugGfx?.clear();
    for (const t of this.debugLabels) t.destroy();
    this.debugLabels = [];
  }

  private drawRoadsideDebug(): void {
    if (!this.debugGfx) {
      this.debugGfx = this.scene.add.graphics().setDepth(DEPTH.hud + 40);
    }
    const g = this.debugGfx;
    g.clear();
    for (const t of this.debugLabels) t.destroy();
    this.debugLabels = [];

    for (const item of this.roadside) {
      const phase: RoadsidePhase = roadsidePhase(item.z, this.proj.maxZ);
      const b = item.sprite.getBounds();
      const color =
        phase === 'PASSED'
          ? 0xff1744
          : phase === 'NEAR'
            ? 0xffd54f
            : phase === 'APPROACHING'
              ? 0x69f0ae
              : 0x80d8ff;

      g.lineStyle(1, color, 0.7);
      g.strokeRect(b.left, b.top, b.width, b.height);
      g.fillStyle(color, 0.15);
      g.fillCircle(item.sprite.x, item.sprite.y, 5);

      const label = this.scene.add
        .text(item.sprite.x, item.sprite.y - 8, '', {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#ffffff',
          backgroundColor: '#000000aa',
          padding: { x: 2, y: 1 },
        })
        .setDepth(DEPTH.hud + 41)
        .setOrigin(0.5, 1);
      label.setText(
        [
          `${phase} ${item.def.category}`,
          `z=${item.z.toFixed(0)} side=${item.side > 0 ? 'R' : 'L'}`,
          `sc=${item.sprite.displayHeight.toFixed(0)} ${item.band}`,
          `b=[${b.left.toFixed(0)},${b.top.toFixed(0)}..${b.right.toFixed(0)},${b.bottom.toFixed(0)}]`,
        ].join('\n'),
      );
      this.debugLabels.push(label);
    }
  }

  // ——— Route ———

  private redrawRoad(dashOffset: number): void {
    const g = this.roadGfx;
    g.clear();
    this.ground.clear();

    const top = this.proj.horizonY;
    const bot = this.BH + 10;
    const far = this.proj.farRoadHalf;
    const near = this.proj.nearRoadHalf;
    const cx = this.proj.centerX;

    this.ground.fillStyle(0x12081f, 1);
    this.ground.fillRect(0, top, this.BW, bot - top);

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
    const left = this.layout.gameOffsetX + 24;
    const right = this.layout.gameOffsetX + this.layout.gameWidth - 24;
    for (let i = 0; i < 7; i++) {
      const x = Phaser.Math.Between(left, right);
      const y1 = Phaser.Math.Between(this.proj.horizonY + 50, this.BH - 140);
      this.speedLines.lineBetween(x, y1, x, y1 + 10 + intensity * 36);
    }
  }
}
