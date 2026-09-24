import Phaser from 'phaser';
import { EQUIPMENTS } from '../config/gameConfig';

/** Génère toutes les textures procédurales (aucun asset externe requis) */
export function generateTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // --- Road tile ---
  g.clear();
  g.fillStyle(0x1a1430, 1);
  g.fillRect(0, 0, 390, 64);
  g.fillStyle(0x12101f, 1);
  g.fillRect(40, 0, 310, 64);
  // lane lines
  g.fillStyle(0xff2d95, 0.55);
  g.fillRect(130, 8, 3, 20);
  g.fillRect(130, 40, 3, 20);
  g.fillRect(257, 8, 3, 20);
  g.fillRect(257, 40, 3, 20);
  // edges
  g.fillStyle(0x9b59ff, 0.7);
  g.fillRect(40, 0, 4, 64);
  g.fillRect(346, 0, 4, 64);
  g.generateTexture('road', 390, 64);

  // --- Player motorcycle (vue de dos) ---
  drawPlayer(g);
  g.generateTexture('player', 64, 96);

  // --- Hearts ---
  g.clear();
  drawHeart(g, 16, 16, 14, 0xff4081);
  g.generateTexture('heart', 32, 32);
  g.clear();
  drawHeart(g, 16, 16, 14, 0x4a4060);
  g.generateTexture('heart-empty', 32, 32);

  // --- Vehicles ---
  drawCar(g, 0x5c6bc0);
  g.generateTexture('car', 48, 80);
  drawTruck(g);
  g.generateTexture('truck', 56, 110);
  drawBarrier(g);
  g.generateTexture('barrier', 52, 28);
  drawCone(g);
  g.generateTexture('cone', 28, 36);
  drawHole(g);
  g.generateTexture('hole', 50, 36);
  drawBarrel(g);
  g.generateTexture('barrel', 36, 48);

  // --- Enemies ---
  drawDepression(g);
  g.generateTexture('depression', 70, 55);
  drawCalomnie(g);
  g.generateTexture('calomnie', 40, 40);
  drawProjectile(g);
  g.generateTexture('projectile', 18, 10);
  drawColere(g);
  g.generateTexture('colere', 60, 50);
  drawPeur(g);
  g.generateTexture('peur', 50, 70);
  drawDoute(g);
  g.generateTexture('doute', 44, 44);
  drawReject(g);
  g.generateTexture('reject', 80, 24);
  drawDistraction(g);
  g.generateTexture('distraction', 64, 64);

  // --- Equipment icons (textures séparées : pickup 48px / HUD 32px) ---
  EQUIPMENTS.forEach((eq) => {
    drawEquipment(g, eq.id, eq.color, 48);
    g.generateTexture(`eq-${eq.id}`, 48, 48);
    drawEquipment(g, eq.id, eq.color, 32);
    g.generateTexture(`eq-icon-${eq.id}`, 32, 32);
  });

  // --- Bonuses ---
  drawMagnet(g);
  g.generateTexture('bonus-magnet', 40, 40);
  drawTempShield(g);
  g.generateTexture('bonus-shield', 40, 40);
  drawLifeBonus(g);
  g.generateTexture('bonus-life', 40, 40);
  drawSlowmo(g);
  g.generateTexture('bonus-slowmo', 40, 40);
  drawBoost(g);
  g.generateTexture('bonus-boost', 40, 40);
  drawLove(g);
  g.generateTexture('love', 48, 48);

  // particles
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture('particle', 8, 8);

  g.clear();
  g.fillStyle(0xff2d95, 1);
  g.fillCircle(6, 6, 6);
  g.generateTexture('particle-pink', 12, 12);

  g.destroy();
}

function drawHeart(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillCircle(cx - s * 0.35, cy - s * 0.15, s * 0.4);
  g.fillCircle(cx + s * 0.35, cy - s * 0.15, s * 0.4);
  g.fillTriangle(cx - s * 0.72, cy, cx + s * 0.72, cy, cx, cy + s * 0.75);
}

function drawPlayer(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  // shadow
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(32, 88, 40, 12);
  // rear wheel
  g.fillStyle(0x222222, 1);
  g.fillCircle(32, 78, 14);
  g.lineStyle(2, 0xff2d95, 1);
  g.strokeCircle(32, 78, 14);
  // body / bike
  g.fillStyle(0x1a1a22, 1);
  g.fillRoundedRect(20, 40, 24, 38, 6);
  g.fillStyle(0xff2d95, 1);
  g.fillRect(22, 55, 20, 4);
  g.fillRect(22, 65, 20, 3);
  // rider jacket
  g.fillStyle(0x111118, 1);
  g.fillRoundedRect(18, 18, 28, 32, 8);
  // crown emblem
  g.fillStyle(0xffd54f, 1);
  g.fillTriangle(32, 28, 26, 38, 38, 38);
  g.fillRect(27, 36, 10, 3);
  // hair
  g.fillStyle(0x2c1810, 1);
  g.fillEllipse(32, 16, 26, 18);
  g.fillRect(20, 16, 6, 22);
  g.fillRect(38, 16, 6, 22);
  // head
  g.fillStyle(0xe8b896, 1);
  g.fillCircle(32, 16, 10);
  // neon glow accents
  g.lineStyle(2, 0xe040fb, 0.8);
  g.strokeRoundedRect(18, 18, 28, 32, 8);
}

function drawCar(g: Phaser.GameObjects.Graphics, color: number): void {
  g.clear();
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(24, 74, 36, 10);
  g.fillStyle(color, 1);
  g.fillRoundedRect(6, 10, 36, 60, 8);
  g.fillStyle(0x1a237e, 1);
  g.fillRoundedRect(10, 18, 28, 16, 4);
  g.fillStyle(0xff5252, 1);
  g.fillRect(10, 64, 8, 4);
  g.fillRect(30, 64, 8, 4);
  g.fillStyle(0xffe082, 1);
  g.fillRect(10, 12, 8, 4);
  g.fillRect(30, 12, 8, 4);
}

function drawTruck(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(28, 102, 44, 12);
  g.fillStyle(0x455a64, 1);
  g.fillRoundedRect(4, 20, 48, 80, 4);
  g.fillStyle(0x37474f, 1);
  g.fillRoundedRect(8, 4, 40, 28, 6);
  g.fillStyle(0x263238, 1);
  g.fillRect(12, 10, 32, 14);
  g.fillStyle(0xff5252, 1);
  g.fillRect(10, 92, 10, 5);
  g.fillRect(36, 92, 10, 5);
}

function drawBarrier(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff6f00, 1);
  g.fillRoundedRect(0, 4, 52, 20, 3);
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 4; i++) {
    g.fillTriangle(4 + i * 12, 4, 10 + i * 12, 4, 4 + i * 12, 24);
  }
}

function drawCone(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff6d00, 1);
  g.fillTriangle(14, 2, 2, 34, 26, 34);
  g.fillStyle(0xffffff, 1);
  g.fillRect(8, 16, 12, 5);
}

function drawHole(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x0a0a12, 1);
  g.fillEllipse(25, 18, 48, 30);
  g.lineStyle(2, 0x5c6bc0, 0.5);
  g.strokeEllipse(25, 18, 48, 30);
}

function drawBarrel(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xc62828, 1);
  g.fillRoundedRect(4, 8, 28, 36, 4);
  g.fillStyle(0xffeb3b, 1);
  g.fillRect(4, 20, 28, 6);
  g.fillStyle(0x212121, 1);
  g.fillTriangle(18, 2, 10, 14, 26, 14);
  g.fillStyle(0xffeb3b, 1);
  g.fillRect(16, 5, 4, 7);
}

function drawDepression(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x1a0033, 0.85);
  g.fillEllipse(35, 28, 68, 48);
  g.fillStyle(0x4a148c, 0.5);
  g.fillEllipse(35, 28, 40, 28);
  g.fillStyle(0x000000, 0.6);
  g.fillCircle(25, 24, 5);
  g.fillCircle(45, 24, 5);
  g.fillStyle(0x7e57c2, 0.4);
  g.fillEllipse(35, 38, 20, 8);
}

function drawCalomnie(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x6a1b9a, 0.9);
  g.fillCircle(20, 20, 18);
  g.fillStyle(0xea80fc, 0.7);
  g.fillCircle(20, 16, 8);
  g.fillStyle(0xce93d8, 0.5);
  g.fillEllipse(20, 30, 16, 8);
}

function drawProjectile(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff2d95, 1);
  g.fillRoundedRect(0, 1, 18, 8, 4);
  g.fillStyle(0xff80ab, 1);
  g.fillCircle(14, 5, 4);
}

function drawColere(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff3d00, 0.85);
  g.fillTriangle(30, 4, 8, 46, 52, 46);
  g.fillStyle(0xffab00, 0.9);
  g.fillTriangle(30, 14, 16, 44, 44, 44);
  g.fillStyle(0xffeb3b, 1);
  g.fillTriangle(30, 24, 22, 42, 38, 42);
}

function drawPeur(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x311b92, 0.75);
  g.fillEllipse(25, 40, 40, 55);
  g.fillStyle(0x000000, 0.5);
  g.fillCircle(18, 30, 6);
  g.fillCircle(32, 30, 6);
  g.fillStyle(0xffffff, 0.3);
  g.fillCircle(18, 28, 2);
  g.fillCircle(32, 28, 2);
}

function drawDoute(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  // ghostly fake equipment look with ? 
  g.lineStyle(2, 0x90a4ae, 0.8);
  g.strokeCircle(22, 22, 18);
  g.fillStyle(0x78909c, 0.35);
  g.fillCircle(22, 22, 16);
  g.fillStyle(0xb0bec5, 1);
  // question mark via rectangles
  g.fillRect(18, 10, 8, 4);
  g.fillRect(24, 14, 6, 8);
  g.fillRect(18, 20, 8, 4);
  g.fillCircle(22, 30, 3);
}

function drawReject(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x880e4f, 0.9);
  g.fillRoundedRect(0, 0, 80, 24, 4);
  g.fillStyle(0xff1744, 1);
  g.fillRect(0, 8, 80, 8);
  g.fillStyle(0xffffff, 0.8);
  for (let i = 0; i < 5; i++) g.fillRect(8 + i * 15, 4, 4, 16);
}

function drawDistraction(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.lineStyle(3, 0x00e5ff, 0.6);
  g.strokeCircle(32, 32, 28);
  g.lineStyle(2, 0xe040fb, 0.5);
  g.strokeCircle(32, 32, 18);
  g.fillStyle(0xffffff, 0.3);
  g.fillCircle(32, 32, 6);
}

function drawEquipment(g: Phaser.GameObjects.Graphics, id: string, color: number, size = 48): void {
  g.clear();
  const s = size / 48;
  const c = size / 2;

  g.fillStyle(color, 0.25);
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
      g.fillStyle(0xfff8e1, 0.6);
      g.fillTriangle(24 * s, 14 * s, 16 * s, 28 * s, 32 * s, 28 * s);
      break;
    case 'shoes':
      g.fillRoundedRect(10 * s, 22 * s, 14 * s, 16 * s, 3 * s);
      g.fillRoundedRect(24 * s, 22 * s, 14 * s, 16 * s, 3 * s);
      g.fillRect(8 * s, 34 * s, 16 * s, 4 * s);
      g.fillRect(24 * s, 34 * s, 16 * s, 4 * s);
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
      g.fillCircle(24 * s, 38 * s, 4 * s);
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
  g.arc(20, 22, 14, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
  g.strokePath();
  g.fillStyle(0xff5252, 1);
  g.fillRect(6, 8, 8, 10);
  g.fillStyle(0x448aff, 1);
  g.fillRect(26, 8, 8, 10);
}

function drawTempShield(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x69f0ae, 0.3);
  g.fillCircle(20, 20, 18);
  g.lineStyle(3, 0x69f0ae, 1);
  g.strokeCircle(20, 20, 16);
  g.fillStyle(0xb9f6ca, 1);
  g.fillEllipse(20, 20, 12, 16);
}

function drawLifeBonus(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  drawHeart(g, 20, 20, 14, 0xff4081);
}

function drawSlowmo(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.lineStyle(3, 0xb388ff, 1);
  g.strokeCircle(20, 20, 16);
  g.fillStyle(0xb388ff, 1);
  g.fillRect(18, 10, 4, 12);
  g.fillRect(18, 20, 10, 4);
}

function drawBoost(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff6e40, 1);
  g.fillTriangle(8, 8, 8, 32, 32, 20);
  g.fillStyle(0xffab40, 1);
  g.fillTriangle(14, 12, 14, 28, 28, 20);
}

function drawLove(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0xff80ab, 0.3);
  g.fillCircle(24, 24, 22);
  drawHeart(g, 24, 24, 16, 0xff2d95);
  g.lineStyle(2, 0xff80ab, 0.9);
  g.strokeCircle(24, 24, 22);
}
