import Phaser from 'phaser';
import { DISPLAY } from '../config/displaySizes';
import {
  LANE_OCCUPANCY,
  occupancyRoleForKey,
  targetWidthForLane,
} from '../config/laneOccupancy';
import { getCurrentLayout } from '../config/responsiveLayout';

/**
 * Applique une largeur d’affichage fixe en conservant le ratio de la texture.
 * Identique pour procédural ou _ext — les pixels natifs ne dictent pas la taille.
 */
export function applyDisplayWidth(
  img: Phaser.GameObjects.Image,
  targetWidth: number,
  maxHeight?: number,
): void {
  const fw = Math.max(1, img.frame.width);
  const fh = Math.max(1, img.frame.height);
  let w = targetWidth;
  let h = targetWidth * (fh / fw);
  if (maxHeight != null && h > maxHeight) {
    h = maxHeight;
    w = maxHeight * (fw / fh);
  }
  img.setDisplaySize(w, h);
  img.setData('displayRole', img.getData('displayRole') ?? 'custom');
}

/** Boîte carrée max (ex. HUD) — le sprite tient dedans sans déborder. */
export function applyDisplayBox(img: Phaser.GameObjects.Image, boxSize: number): void {
  const fw = Math.max(1, img.frame.width);
  const fh = Math.max(1, img.frame.height);
  const scale = Math.min(boxSize / fw, boxSize / fh);
  img.setDisplaySize(fw * scale, fh * scale);
}

/** Hauteur fixe, largeur selon ratio. */
export function applyDisplayHeight(img: Phaser.GameObjects.Image, targetHeight: number): void {
  const fw = Math.max(1, img.frame.width);
  const fh = Math.max(1, img.frame.height);
  const h = targetHeight;
  const w = targetHeight * (fw / fh);
  img.setDisplaySize(w, h);
}

export function applyPlayerDisplay(img: Phaser.GameObjects.Image): void {
  const L = getCurrentLayout();
  applyDisplayWidth(img, L.playerDisplayWidth, L.playerDisplayHeightMax);
  img.setData('displayRole', 'player');
  img.setData('laneOccupancy', LANE_OCCUPANCY.motorcycle);
}

/** Icône HUD — taille calculée + clampée, jamais native PNG. */
export function applyHudEquipmentIcon(img: Phaser.GameObjects.Image): void {
  const L = getCurrentLayout();
  applyDisplayBox(img, L.hudIconSize);
  img.setData('displayRole', 'hud-equipment');
}

/** Équipement collectable sur la route. */
export function applyWorldEquipmentDisplay(img: Phaser.GameObjects.Image): void {
  const L = getCurrentLayout();
  const w = targetWidthForLane(L.laneWidthNear, 'equipment');
  applyDisplayWidth(img, w, L.worldEquipmentSize * 1.35);
  img.setData('displayRole', 'world-equipment');
  img.setData('laneOccupancy', LANE_OCCUPANCY.equipment);
}

/**
 * Après setTexture / changement de clé : réapplique la taille prévue selon le rôle.
 * Véhicules/obstacles : largeur = laneWidth × occupancy (remplissage de voie).
 */
export function applyWorldDisplayForKey(img: Phaser.GameObjects.Image, logicalKey: string): void {
  const key = logicalKey.replace(/_ext$/, '');
  const L = getCurrentLayout();
  const laneW = L.laneWidthNear;

  if (key.startsWith('eq-icon-')) {
    applyHudEquipmentIcon(img);
    return;
  }
  if (key.startsWith('eq-')) {
    applyWorldEquipmentDisplay(img);
    return;
  }

  if (key.startsWith('building_')) {
    applyDisplayHeight(img, L.buildingNearHeight ?? L.buildingBaseHeight);
    img.setData('displayRole', 'building');
    return;
  }

  const role = occupancyRoleForKey(key);
  if (role === 'car' || role === 'truck' || role === 'largeObstacle' || role === 'smallObstacle') {
    const tw = targetWidthForLane(laneW, role);
    // Hauteur max pour éviter les sprites trop hauts (aspect PNG)
    const maxH =
      role === 'truck'
        ? L.worldTruckHeight * 1.35
        : role === 'car'
          ? L.worldCarHeight * 1.4
          : role === 'largeObstacle'
            ? L.worldCarHeight * 1.1
            : L.worldCarHeight * 0.85;
    applyDisplayWidth(img, tw, maxH);
    img.setData('displayRole', key);
    img.setData('laneOccupancy', LANE_OCCUPANCY[role]);
    return;
  }

  if (role === 'bonus') {
    applyDisplayBox(img, targetWidthForLane(laneW, 'bonus'));
    img.setData('displayRole', key);
    img.setData('laneOccupancy', LANE_OCCUPANCY.bonus);
    return;
  }

  if (role === 'enemy') {
    applyDisplayWidth(img, targetWidthForLane(laneW, 'enemy'), L.worldCarHeight * 1.15);
    img.setData('displayRole', key);
    img.setData('laneOccupancy', LANE_OCCUPANCY.enemy);
    return;
  }

  if (role === 'projectile') {
    applyDisplayWidth(img, targetWidthForLane(laneW, 'projectile'));
    img.setData('displayRole', key);
    img.setData('laneOccupancy', LANE_OCCUPANCY.projectile);
    return;
  }

  // Props / fallback hauteur
  const map: Record<string, number> = {
    'prop-lamp': L.propLampHeight,
    'prop-palm': L.propPalmHeight,
    reject: DISPLAY.WORLD_REJECT_HEIGHT * L.worldObstacleScale,
  };
  if (map[key] != null) {
    applyDisplayHeight(img, map[key]!);
    img.setData('displayRole', key);
    return;
  }

  applyDisplayHeight(img, 48 * L.worldObstacleScale);
  img.setData('displayRole', key);
}

export function reapplyDisplayRole(img: Phaser.GameObjects.Image, logicalKey?: string): void {
  const role = img.getData('displayRole') as string | undefined;
  if (role === 'hud-equipment') {
    applyHudEquipmentIcon(img);
    return;
  }
  if (role === 'world-equipment') {
    applyWorldEquipmentDisplay(img);
    return;
  }
  if (role === 'player') {
    applyPlayerDisplay(img);
    return;
  }
  if (logicalKey) {
    applyWorldDisplayForKey(img, logicalKey);
  }
}

export function applyDepthScale(img: Phaser.GameObjects.Image, depthScale: number): void {
  const baseW = img.getData('baseDisplayW') as number | undefined;
  const baseH = img.getData('baseDisplayH') as number | undefined;
  if (baseW != null && baseH != null) {
    img.setDisplaySize(baseW * depthScale, baseH * depthScale);
    return;
  }
  img.setScale(img.scaleX * depthScale, img.scaleY * depthScale);
}

export function rememberBaseDisplay(img: Phaser.GameObjects.Image): void {
  img.setData('baseDisplayW', img.displayWidth);
  img.setData('baseDisplayH', img.displayHeight);
}
