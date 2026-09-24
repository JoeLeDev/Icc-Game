import Phaser from 'phaser';
import { DISPLAY } from '../config/displaySizes';
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
  applyDisplayBox(img, L.worldEquipmentSize);
  img.setData('displayRole', 'world-equipment');
}

/**
 * Après setTexture / changement de clé : réapplique la taille prévue selon le rôle.
 * Ne laisse JAMAIS les dimensions natives du PNG dicter l’affichage.
 */
export function applyWorldDisplayForKey(img: Phaser.GameObjects.Image, logicalKey: string): void {
  const key = logicalKey.replace(/_ext$/, '');
  const L = getCurrentLayout();
  const scale = L.worldObstacleScale;

  // HUD icons — jamais la taille monde ni native
  if (key.startsWith('eq-icon-')) {
    applyHudEquipmentIcon(img);
    return;
  }
  if (key.startsWith('eq-')) {
    applyWorldEquipmentDisplay(img);
    return;
  }

  const map: Record<string, { mode: 'w' | 'h' | 'box'; size: number; maxH?: number }> = {
    player: { mode: 'w', size: L.playerDisplayWidth, maxH: L.playerDisplayHeightMax },
    car: { mode: 'h', size: L.worldCarHeight },
    truck: { mode: 'h', size: L.worldTruckHeight },
    barrel: { mode: 'h', size: DISPLAY.WORLD_BARREL_HEIGHT * scale },
    barrier: { mode: 'h', size: DISPLAY.WORLD_BARRIER_HEIGHT * scale },
    cone: { mode: 'h', size: DISPLAY.WORLD_CONE_HEIGHT * scale },
    hole: { mode: 'h', size: DISPLAY.WORLD_HOLE_HEIGHT * scale },
    love: { mode: 'box', size: L.worldLoveSize },
    depression: { mode: 'h', size: DISPLAY.WORLD_DEPRESSION_HEIGHT * scale },
    calomnie: { mode: 'h', size: DISPLAY.WORLD_CALOMNIE_HEIGHT * scale },
    peur: { mode: 'h', size: DISPLAY.WORLD_PEUR_HEIGHT * scale },
    doute: { mode: 'h', size: DISPLAY.WORLD_DOUTE_HEIGHT * scale },
    colere: { mode: 'h', size: DISPLAY.WORLD_COLERE_HEIGHT * scale },
    projectile: { mode: 'h', size: DISPLAY.WORLD_PROJECTILE_HEIGHT * scale },
    reject: { mode: 'h', size: DISPLAY.WORLD_REJECT_HEIGHT * scale },
    'prop-lamp': { mode: 'h', size: L.propLampHeight },
    'prop-palm': { mode: 'h', size: L.propPalmHeight },
    'bonus-magnet': { mode: 'box', size: L.worldBonusSize },
    'bonus-shield': { mode: 'box', size: L.worldBonusSize },
    'bonus-life': { mode: 'box', size: L.worldBonusSize },
    'bonus-slowmo': { mode: 'box', size: L.worldBonusSize },
    'bonus-boost': { mode: 'box', size: L.worldBonusSize },
  };

  if (key.startsWith('building_')) {
    applyDisplayHeight(img, L.buildingNearHeight ?? L.buildingBaseHeight);
    img.setData('displayRole', 'building');
    return;
  }

  const spec = map[key];
  if (!spec) {
    applyDisplayHeight(img, 48 * scale);
    return;
  }
  if (spec.mode === 'w') applyDisplayWidth(img, spec.size, spec.maxH);
  else if (spec.mode === 'h') applyDisplayHeight(img, spec.size);
  else applyDisplayBox(img, spec.size);
  img.setData('displayRole', key);
}

/**
 * Réapplique la taille selon le rôle mémorisé (après setTexture).
 */
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

/** Facteur d’échelle profondeur : multiplie displayWidth/Height déjà normalisés. */
export function applyDepthScale(img: Phaser.GameObjects.Image, depthScale: number): void {
  const baseW = img.getData('baseDisplayW') as number | undefined;
  const baseH = img.getData('baseDisplayH') as number | undefined;
  if (baseW != null && baseH != null) {
    img.setDisplaySize(baseW * depthScale, baseH * depthScale);
    return;
  }
  img.setScale(img.scaleX * depthScale, img.scaleY * depthScale);
}

/** Mémorise la taille d’affichage « z=0 » après normalisation. */
export function rememberBaseDisplay(img: Phaser.GameObjects.Image): void {
  img.setData('baseDisplayW', img.displayWidth);
  img.setData('baseDisplayH', img.displayHeight);
}
