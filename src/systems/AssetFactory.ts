import Phaser from 'phaser';
import { EQUIPMENTS } from '../config/gameConfig';

/**
 * Textures procédurales + hooks pour assets PNG remplaçables dans /public/assets/.
 * La planche maquette n’est PAS utilisée comme texture de gameplay.
 */
export function generateTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  drawPlayer(g);
  g.generateTexture('player', 72, 110);

  g.clear();
  drawHeart(g, 16, 16, 14, 0xff4081);
  g.generateTexture('heart', 32, 32);
  g.clear();
  drawHeart(g, 16, 16, 14, 0x4a4060);
  g.generateTexture('heart-empty', 32, 32);

  drawCar(g, 0x5c6bc0);
  g.generateTexture('car', 56, 88);
  drawTruck(g);
  g.generateTexture('truck', 64, 120);
  drawBarrier(g);
  g.generateTexture('barrier', 56, 30);
  drawCone(g);
  g.generateTexture('cone', 30, 38);
  drawHole(g);
  g.generateTexture('hole', 54, 38);
  drawBarrel(g);
  g.generateTexture('barrel', 40, 52);

  drawDepression(g);
  g.generateTexture('depression', 72, 56);
  drawCalomnie(g);
  g.generateTexture('calomnie', 42, 42);
  drawProjectile(g);
  g.generateTexture('projectile', 20, 12);
  drawColere(g);
  g.generateTexture('colere', 64, 52);
  drawPeur(g);
  g.generateTexture('peur', 52, 72);
  drawDoute(g);
  g.generateTexture('doute', 46, 46);
  drawReject(g);
  g.generateTexture('reject', 88, 26);
  drawDistraction(g);
  g.generateTexture('distraction', 64, 64);

  EQUIPMENTS.forEach((eq) => {
    drawEquipment(g, eq.id, eq.color, 56);
    g.generateTexture(`eq-${eq.id}`, 56, 56);
    drawEquipment(g, eq.id, eq.color, 36);
    g.generateTexture(`eq-icon-${eq.id}`, 36, 36);
  });

  drawMagnet(g);
  g.generateTexture('bonus-magnet', 44, 44);
  drawTempShield(g);
  g.generateTexture('bonus-shield', 44, 44);
  drawLifeBonus(g);
  g.generateTexture('bonus-life', 44, 44);
  drawSlowmo(g);
  g.generateTexture('bonus-slowmo', 44, 44);
  drawBoost(g);
  g.generateTexture('bonus-boost', 44, 44);
  drawLove(g);
  g.generateTexture('love', 56, 56);

  drawLamp(g);
  g.generateTexture('prop-lamp', 28, 64);
  drawPalm(g);
  g.generateTexture('prop-palm', 40, 70);
  drawSideBuilding(g);
  g.generateTexture('prop-building', 36, 56);

  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture('particle', 8, 8);
  g.clear();
  g.fillStyle(0xff2d95, 1);
  g.fillCircle(6, 6, 6);
  g.generateTexture('particle-pink', 12, 12);
  g.clear();
  g.fillStyle(0xffd54f, 1);
  g.fillCircle(5, 5, 5);
  g.generateTexture('particle-gold', 10, 10);

  g.destroy();
}

/** Tente de remplacer des clés procédurales par des PNG dans /assets/ si présents. */
export async function tryLoadExternalAssets(scene: Phaser.Scene): Promise<string[]> {
  const candidates: { key: string; path: string }[] = [
    { key: 'player', path: 'assets/player_moto.png' },
    { key: 'car', path: 'assets/car.png' },
    { key: 'truck', path: 'assets/truck.png' },
    { key: 'barrel', path: 'assets/barrel.png' },
    { key: 'barrier', path: 'assets/barrier.png' },
    { key: 'cone', path: 'assets/cone.png' },
    { key: 'hole', path: 'assets/hole.png' },
    { key: 'love', path: 'assets/love_heart.png' },
    { key: 'bonus-magnet', path: 'assets/bonus_magnet.png' },
    { key: 'bonus-shield', path: 'assets/bonus_shield.png' },
    { key: 'bonus-life', path: 'assets/bonus_life.png' },
    { key: 'bonus-slowmo', path: 'assets/bonus_slowmo.png' },
    { key: 'bonus-boost', path: 'assets/bonus_boost.png' },
    { key: 'depression', path: 'assets/enemy_depression.png' },
    { key: 'calomnie', path: 'assets/enemy_calomnie.png' },
    { key: 'peur', path: 'assets/enemy_peur.png' },
    { key: 'doute', path: 'assets/enemy_doute.png' },
    { key: 'projectile', path: 'assets/fx_projectile.png' },
    { key: 'colere', path: 'assets/fx_fire.png' },
    { key: 'prop-lamp', path: 'assets/prop_lamp.png' },
    { key: 'prop-palm', path: 'assets/prop_palm.png' },
    { key: 'skyline', path: 'assets/skyline.png' },
  ];
  EQUIPMENTS.forEach((eq) => {
    candidates.push({ key: `eq-${eq.id}`, path: `assets/eq_${eq.id}.png` });
    candidates.push({ key: `eq-icon-${eq.id}`, path: `assets/eq_${eq.id}.png` });
  });

  /** Hauteurs d’affichage cibles (px jeu) — calées sur la moto (~118) */
  const TARGET_H: Record<string, number> = {
    player: 118,
    car: 72,
    truck: 96,
    barrel: 44,
    barrier: 26,
    cone: 34,
    hole: 26,
    love: 46,
    depression: 52,
    calomnie: 40,
    peur: 64,
    doute: 42,
    projectile: 12,
    colere: 48,
    'prop-lamp': 120,
    'prop-palm': 140,
    'bonus-magnet': 36,
    'bonus-shield': 36,
    'bonus-life': 36,
    'bonus-slowmo': 36,
    'bonus-boost': 36,
  };
  EQUIPMENTS.forEach((eq) => {
    TARGET_H[`eq-${eq.id}`] = 48;
    TARGET_H[`eq-icon-${eq.id}`] = 32;
  });

  const loaded: string[] = [];
  for (const c of candidates) {
    try {
      const ok = await loadImageIfExists(scene, c.key + '_ext', c.path);
      if (ok && scene.textures.exists(c.key + '_ext')) {
        promoteExternalTexture(scene, c.key);
        loaded.push(c.path);
      }
    } catch {
      /* ignore */
    }
  }

  // Mémorise les facteurs d’échelle pour le gameplay
  (scene.registry as Phaser.Data.DataManager).set('textureTargetH', TARGET_H);
  return loaded;
}

/** Remplace la texture procédurale `key` par l’image `key_ext` (même nom de clé). */
function promoteExternalTexture(scene: Phaser.Scene, key: string): void {
  const extKey = key + '_ext';
  if (!scene.textures.exists(extKey)) return;
  const src = scene.textures.get(extKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addImage(key, src as HTMLImageElement);
}

/**
 * Préfère la clé de base (déjà remplacée par le PNG après promote).
 * `_ext` reste un fallback si la promotion a échoué.
 */
export function textureKey(base: string, scene: Phaser.Scene): string {
  if (scene.textures.exists(base)) return base;
  if (scene.textures.exists(base + '_ext')) return base + '_ext';
  return base;
}

/** Scale pour qu’une texture HD ait la hauteur logique attendue. */
export function fitTextureScale(scene: Phaser.Scene, key: string, fallbackTargetH?: number): number {
  if (!scene.textures.exists(key)) return 1;
  const frame = scene.textures.getFrame(key);
  const h = Math.max(1, frame.height || 64);
  const lookup = key.replace(/_ext$/, '');
  const targets = scene.registry.get('textureTargetH') as Record<string, number> | undefined;
  const target = targets?.[lookup] ?? fallbackTargetH;
  // Texture procédurale déjà à la bonne taille : pas de redimensionnement
  if (target == null) return h <= 130 ? 1 : 64 / h;
  return target / h;
}

function loadImageIfExists(scene: Phaser.Scene, key: string, path: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (scene.textures.exists(key)) {
      resolve(true);
      return;
    }
    const img = new Image();
    img.onload = () => {
      scene.textures.addImage(key, img);
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = path;
  });
}

function drawHeart(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillCircle(cx - s * 0.35, cy - s * 0.15, s * 0.4);
  g.fillCircle(cx + s * 0.35, cy - s * 0.15, s * 0.4);
  g.fillTriangle(cx - s * 0.72, cy, cx + s * 0.72, cy, cx, cy + s * 0.75);
}

function drawPlayer(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  // Ombre au sol
  g.fillStyle(0x000000, 0.45);
  g.fillEllipse(36, 104, 48, 12);

  // Garde-boue / carénage inférieur
  g.fillStyle(0x0c0c14, 1);
  g.fillRoundedRect(20, 62, 32, 28, 8);

  // Roue arrière (vue de dos)
  g.fillStyle(0x111118, 1);
  g.fillCircle(36, 90, 17);
  g.lineStyle(3, 0xff2d95, 1);
  g.strokeCircle(36, 90, 17);
  g.fillStyle(0xff2d95, 0.4);
  g.fillCircle(36, 90, 7);
  g.lineStyle(1.5, 0xff80ab, 0.8);
  g.strokeCircle(36, 90, 10);

  // Double feu arrière
  g.fillStyle(0xff1744, 1);
  g.fillRoundedRect(24, 68, 9, 12, 2);
  g.fillRoundedRect(39, 68, 9, 12, 2);
  g.fillStyle(0xff80ab, 0.85);
  g.fillCircle(28.5, 74, 3.5);
  g.fillCircle(43.5, 74, 3.5);

  // Selle / corps moto
  g.fillStyle(0x161622, 1);
  g.fillRoundedRect(22, 48, 28, 22, 6);
  g.fillStyle(0xe040fb, 1);
  g.fillRect(24, 56, 24, 3);
  g.fillStyle(0x00e5ff, 0.7);
  g.fillRect(24, 62, 24, 2);

  // Bras / guidon (légèrement visibles)
  g.fillStyle(0x1a1a24, 1);
  g.fillRoundedRect(12, 36, 14, 8, 3);
  g.fillRoundedRect(46, 36, 14, 8, 3);

  // Blouson
  g.fillStyle(0x0a0a12, 1);
  g.fillRoundedRect(20, 20, 32, 36, 10);
  g.lineStyle(2, 0x9b59ff, 0.95);
  g.strokeRoundedRect(20, 20, 32, 36, 10);
  g.fillStyle(0xffd54f, 0.9);
  g.fillRect(33, 26, 6, 22);

  // Cheveux longs (avant la tête pour halo)
  g.fillStyle(0x1a0c08, 1);
  g.fillEllipse(36, 16, 34, 20);
  g.fillTriangle(14, 14, 22, 58, 28, 20);
  g.fillTriangle(58, 14, 50, 58, 44, 20);
  g.fillTriangle(20, 20, 18, 64, 30, 36);
  g.fillTriangle(52, 20, 54, 64, 42, 36);

  // Tête
  g.fillStyle(0xe8b896, 1);
  g.fillCircle(36, 14, 11);

  // Couronne dorée (au-dessus)
  g.fillStyle(0xffd54f, 1);
  g.fillTriangle(36, 0, 26, 14, 46, 14);
  g.fillRect(28, 12, 16, 4);
  g.fillStyle(0xfff8e1, 1);
  g.fillCircle(36, 8, 2.5);
  g.fillCircle(30, 12, 1.5);
  g.fillCircle(42, 12, 1.5);
}

function drawCar(g: Phaser.GameObjects.Graphics, color: number): void {
  g.clear();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(28, 80, 40, 12);
  g.fillStyle(color, 1);
  g.fillRoundedRect(8, 12, 40, 64, 9);
  g.fillStyle(0x0d1b4c, 1);
  g.fillRoundedRect(12, 20, 32, 18, 4);
  g.fillStyle(0xff5252, 1);
  g.fillRect(12, 68, 10, 5);
  g.fillRect(34, 68, 10, 5);
  g.fillStyle(0xffe082, 1);
  g.fillRect(12, 14, 10, 5);
  g.fillRect(34, 14, 10, 5);
  g.lineStyle(1, 0x00e5ff, 0.4);
  g.strokeRoundedRect(8, 12, 40, 64, 9);
}

function drawTruck(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(32, 112, 48, 12);
  g.fillStyle(0x455a64, 1);
  g.fillRoundedRect(6, 24, 52, 84, 4);
  g.fillStyle(0x37474f, 1);
  g.fillRoundedRect(10, 4, 44, 30, 6);
  g.fillStyle(0x1a237e, 0.8);
  g.fillRect(14, 10, 36, 16);
  g.fillStyle(0xff5252, 1);
  g.fillRect(12, 100, 12, 6);
  g.fillRect(40, 100, 12, 6);
}

function drawBarrier(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff6f00, 1);
  g.fillRoundedRect(0, 4, 56, 22, 3);
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 4; i++) g.fillTriangle(4 + i * 13, 4, 11 + i * 13, 4, 4 + i * 13, 26);
}

function drawCone(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff6d00, 1);
  g.fillTriangle(15, 2, 2, 36, 28, 36);
  g.fillStyle(0xffffff, 1);
  g.fillRect(8, 16, 14, 5);
}

function drawHole(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x050508, 1);
  g.fillEllipse(27, 19, 52, 32);
  g.lineStyle(2, 0x5c6bc0, 0.45);
  g.strokeEllipse(27, 19, 52, 32);
}

function drawBarrel(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xc62828, 1);
  g.fillRoundedRect(6, 10, 28, 38, 4);
  g.fillStyle(0xffeb3b, 1);
  g.fillRect(6, 22, 28, 7);
  g.fillStyle(0x212121, 1);
  g.fillTriangle(20, 2, 11, 16, 29, 16);
  g.fillStyle(0xffeb3b, 1);
  g.fillRect(18, 6, 4, 8);
}

function drawDepression(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x1a0033, 0.9);
  g.fillEllipse(36, 28, 70, 50);
  g.fillStyle(0x4a148c, 0.5);
  g.fillEllipse(36, 28, 42, 30);
  g.fillStyle(0x000000, 0.65);
  g.fillCircle(26, 24, 5);
  g.fillCircle(46, 24, 5);
}

function drawCalomnie(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x6a1b9a, 0.92);
  g.fillCircle(21, 21, 19);
  g.fillStyle(0xea80fc, 0.75);
  g.fillCircle(21, 16, 8);
  g.fillStyle(0xce93d8, 0.5);
  g.fillEllipse(21, 32, 16, 8);
}

function drawProjectile(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff2d95, 1);
  g.fillRoundedRect(0, 2, 20, 8, 4);
  g.fillStyle(0xff80ab, 1);
  g.fillCircle(16, 6, 5);
}

function drawColere(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff3d00, 0.9);
  g.fillTriangle(32, 4, 8, 48, 56, 48);
  g.fillStyle(0xffab00, 0.95);
  g.fillTriangle(32, 14, 16, 46, 48, 46);
  g.fillStyle(0xffeb3b, 1);
  g.fillTriangle(32, 24, 22, 44, 42, 44);
}

function drawPeur(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x311b92, 0.8);
  g.fillEllipse(26, 42, 42, 58);
  g.fillStyle(0x000000, 0.55);
  g.fillCircle(18, 30, 6);
  g.fillCircle(34, 30, 6);
}

function drawDoute(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.lineStyle(2, 0x90a4ae, 0.85);
  g.strokeCircle(23, 23, 19);
  g.fillStyle(0x78909c, 0.35);
  g.fillCircle(23, 23, 17);
  g.fillStyle(0xb0bec5, 1);
  g.fillRect(19, 10, 8, 4);
  g.fillRect(25, 14, 6, 8);
  g.fillRect(19, 20, 8, 4);
  g.fillCircle(23, 31, 3);
}

function drawReject(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x880e4f, 0.92);
  g.fillRoundedRect(0, 0, 88, 26, 4);
  g.fillStyle(0xff1744, 1);
  g.fillRect(0, 9, 88, 8);
}

function drawDistraction(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.lineStyle(3, 0x00e5ff, 0.65);
  g.strokeCircle(32, 32, 28);
  g.lineStyle(2, 0xe040fb, 0.55);
  g.strokeCircle(32, 32, 18);
}

function drawEquipment(g: Phaser.GameObjects.Graphics, id: string, color: number, size = 48): void {
  g.clear();
  const s = size / 48;
  const c = size / 2;
  g.fillStyle(color, 0.22);
  g.fillCircle(c, c, 22 * s);
  g.lineStyle(Math.max(1.5, 2 * s), color, 1);
  g.strokeCircle(c, c, 20 * s);
  g.fillStyle(color, 1);
  switch (id) {
    case 'belt':
      g.fillRoundedRect(8 * s, 18 * s, 32 * s, 12 * s, 3 * s);
      g.fillStyle(0xfff8e1, 1);
      g.fillRect(20 * s, 20 * s, 8 * s, 8 * s);
      break;
    case 'breastplate':
      g.fillRoundedRect(12 * s, 10 * s, 24 * s, 28 * s, 4 * s);
      g.fillStyle(0xfff8e1, 0.65);
      g.fillTriangle(24 * s, 14 * s, 16 * s, 28 * s, 32 * s, 28 * s);
      break;
    case 'shoes':
      g.fillRoundedRect(10 * s, 22 * s, 14 * s, 16 * s, 3 * s);
      g.fillRoundedRect(24 * s, 22 * s, 14 * s, 16 * s, 3 * s);
      break;
    case 'shield':
      g.fillEllipse(24 * s, 24 * s, 22 * s, 28 * s);
      g.fillStyle(0xfff8e1, 1);
      g.fillRect(22 * s, 14 * s, 4 * s, 20 * s);
      g.fillRect(14 * s, 22 * s, 20 * s, 4 * s);
      break;
    case 'helmet':
      g.fillEllipse(24 * s, 22 * s, 24 * s, 22 * s);
      g.fillRect(12 * s, 24 * s, 24 * s, 10 * s);
      g.fillStyle(0x212121, 1);
      g.fillRect(14 * s, 26 * s, 20 * s, 6 * s);
      break;
    case 'sword':
      g.fillRect(22 * s, 6 * s, 4 * s, 28 * s);
      g.fillRect(14 * s, 30 * s, 20 * s, 4 * s);
      g.fillTriangle(24 * s, 2 * s, 18 * s, 10 * s, 30 * s, 10 * s);
      break;
    case 'prayer':
      g.fillStyle(0x7b1fa2, 1);
      g.fillRoundedRect(12 * s, 10 * s, 24 * s, 28 * s, 2 * s);
      g.fillStyle(0xffd54f, 1);
      g.fillRect(22 * s, 16 * s, 4 * s, 14 * s);
      g.fillRect(17 * s, 21 * s, 14 * s, 4 * s);
      break;
  }
}

function drawMagnet(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.lineStyle(6, 0x00e5ff, 1);
  g.beginPath();
  g.arc(22, 24, 15, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
  g.strokePath();
  g.fillStyle(0xff5252, 1);
  g.fillRect(7, 8, 9, 11);
  g.fillStyle(0x448aff, 1);
  g.fillRect(28, 8, 9, 11);
}

function drawTempShield(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x69f0ae, 0.3);
  g.fillCircle(22, 22, 19);
  g.lineStyle(3, 0x69f0ae, 1);
  g.strokeCircle(22, 22, 17);
}

function drawLifeBonus(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  drawHeart(g, 22, 22, 15, 0xff4081);
}

function drawSlowmo(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.lineStyle(3, 0xb388ff, 1);
  g.strokeCircle(22, 22, 17);
  g.fillStyle(0xb388ff, 1);
  g.fillRect(20, 10, 4, 13);
  g.fillRect(20, 21, 11, 4);
}

function drawBoost(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff6e40, 1);
  g.fillTriangle(8, 8, 8, 36, 36, 22);
  g.fillStyle(0xffab40, 1);
  g.fillTriangle(14, 12, 14, 32, 30, 22);
}

function drawLove(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff80ab, 0.35);
  g.fillCircle(28, 28, 26);
  drawHeart(g, 28, 28, 18, 0xff2d95);
  g.lineStyle(2, 0xff80ab, 1);
  g.strokeCircle(28, 28, 26);
}

function drawLamp(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x2a2a35, 1);
  g.fillRect(12, 18, 4, 42);
  g.fillStyle(0xffd54f, 0.9);
  g.fillCircle(14, 14, 8);
  g.fillStyle(0xffd54f, 0.25);
  g.fillCircle(14, 14, 14);
}

function drawPalm(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x5d4037, 1);
  g.fillRect(18, 28, 5, 40);
  g.fillStyle(0x2e7d32, 1);
  g.fillTriangle(20, 30, 4, 12, 20, 18);
  g.fillTriangle(20, 30, 36, 12, 20, 18);
  g.fillTriangle(20, 28, 10, 4, 30, 4);
}

function drawSideBuilding(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x1a0f30, 1);
  g.fillRect(4, 8, 28, 48);
  g.fillStyle(0xff2d95, 0.5);
  g.fillRect(8, 14, 5, 5);
  g.fillStyle(0x00e5ff, 0.45);
  g.fillRect(18, 24, 5, 5);
  g.fillStyle(0xffd54f, 0.4);
  g.fillRect(8, 34, 5, 5);
}
