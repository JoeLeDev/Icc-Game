/**
 * Courbes d’échelle roadside — bâtiment ≠ prop, même profondeur de référence.
 * u = 1 à la caméra (z=0), 0 à l’horizon (z=maxZ).
 * z < 0 = PASSED : échelle quasi figée (sortie verticale).
 */

import { passedExitT } from './roadsideLifecycle';

export function depthUnit(z: number, maxZ: number): number {
  if (z < 0) return 1;
  const t = Math.max(0, Math.min(1, z / Math.max(1, maxZ)));
  return 1 - t;
}

export const BUILDING_SCALE_POWER = 1.55;
export const PROP_SCALE_POWER = 1.2;

export function buildingScale(z: number, maxZ: number): number {
  return Math.pow(depthUnit(z, maxZ), BUILDING_SCALE_POWER);
}

export function propScale(z: number, maxZ: number): number {
  return Math.pow(depthUnit(z, maxZ), PROP_SCALE_POWER);
}

export function buildingDisplayHeight(
  z: number,
  maxZ: number,
  nearHeight: number,
  farHeight: number,
): number {
  if (z < 0) {
    return nearHeight * (1 + Math.min(0.15, passedExitT(z) * 0.08));
  }
  const s = buildingScale(z, maxZ);
  return farHeight + (nearHeight - farHeight) * s;
}

export function propDisplayHeight(
  z: number,
  maxZ: number,
  nearHeight: number,
  farHeight: number,
): number {
  if (z < 0) return nearHeight * (1 + Math.min(0.12, passedExitT(z) * 0.06));
  const s = propScale(z, maxZ);
  return farHeight + (nearHeight - farHeight) * s;
}

export function buildingOverPropRatio(
  z: number,
  maxZ: number,
  buildingNear: number,
  buildingFar: number,
  propNear: number,
  propFar: number,
): number {
  const bh = buildingDisplayHeight(z, maxZ, buildingNear, buildingFar);
  const ph = propDisplayHeight(z, maxZ, propNear, propFar);
  return bh / Math.max(1, ph);
}
