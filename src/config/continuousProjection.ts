/**
 * Projection Y continue (approche → joueur → passed → despawn).
 *
 * Cause de l’ancien ralentissement : depthT = (z/maxZ)² utilisé pour Y
 * ⇒ dy/dz → 0 quand z → 0 (l’objet « freinait » à l’écran près de la moto).
 *
 * Ici : progress p = 1 − z/maxZ (0 horizon, 1 joueur, >1 derrière).
 * Y = horizon + span × p^k avec k > 1 → accélère vers la caméra,
 * et la pente à p=1 est non nulle (raccord avec PASSED).
 */

/** k > 1 : plus on approche, plus |dy/dz| augmente */
export const Y_APPROACH_POWER = 1.55;

/** p = 0 à l’horizon, 1 au plan joueur, >1 après dépassement */
export function depthProgress(z: number, maxZ: number): number {
  return 1 - z / Math.max(1, maxZ);
}

export function approachSlope(playerY: number, horizonY: number, power = Y_APPROACH_POWER): number {
  return (playerY - horizonY) * power;
}

/**
 * Y écran continu pour tout z (y compris négatif).
 * Aucun clamp à z=0 qui annule la vitesse verticale.
 */
export function projectYContinuous(
  z: number,
  maxZ: number,
  horizonY: number,
  playerY: number,
  power = Y_APPROACH_POWER,
): number {
  const p = depthProgress(z, maxZ);
  const span = playerY - horizonY;
  if (p <= 0) return horizonY;
  if (p <= 1) {
    return horizonY + span * Math.pow(p, power);
  }
  // PASSED : pente = d/dp(p^k)|_1 = k × span — continue sans freiner
  const slope = span * power;
  return playerY + (p - 1) * slope * 1.15;
}

/**
 * Vitesse verticale écran pour dz (typiquement −1 = se rapproche).
 * Doit rester > 0 près de z=0 et croître avec la proximité.
 */
export function screenYSpeedForDz(
  z: number,
  maxZ: number,
  horizonY: number,
  playerY: number,
  dz = -1,
  power = Y_APPROACH_POWER,
): number {
  const y0 = projectYContinuous(z, maxZ, horizonY, playerY, power);
  const y1 = projectYContinuous(z + dz, maxZ, horizonY, playerY, power);
  return y1 - y0;
}

/**
 * Demi-largeur de route linéaire en Y écran → bords droits (trapèze).
 * Ne pas coupler à depthT² : sinon X et Y non-linéaires ⇒ route courbée.
 * t = 0 à l’horizon, 1 au plan joueur ; t > 1 sous la moto (dessin bas d’écran).
 */
export function roadHalfFromScreenY(
  y: number,
  horizonY: number,
  playerY: number,
  nearHalf: number,
  farHalf: number,
): number {
  const span = Math.max(1, playerY - horizonY);
  const t = Math.max(0, (y - horizonY) / span);
  return farHalf + (nearHalf - farHalf) * t;
}

/**
 * X écran décor roadside — trajectoire continue APPROCHE → PASSED.
 *
 * Ancienne cause du « retour vers le centre » : roadHalf figé à nearHalf
 * dès z < 0 alors que Y continue sous playerY → |x−center| stagnait / semblait
 * se refermer. Ici roadHalf suit Y sans rupture au plan joueur.
 *
 * @param side -1 gauche | +1 droite (stable au spawn)
 * @param lateralMul facteur d’écartement hors chaussée (stable au spawn)
 */
export function projectSceneryX(
  side: -1 | 1,
  z: number,
  maxZ: number,
  centerX: number,
  horizonY: number,
  playerY: number,
  nearHalf: number,
  farHalf: number,
  lateralMul: number,
  marginPx = 0,
): number {
  const y = projectYContinuous(z, maxZ, horizonY, playerY);
  const half = roadHalfFromScreenY(y, horizonY, playerY, nearHalf, farHalf);
  return centerX + side * (half * lateralMul + marginPx);
}

/** |screenX − vanishingPoint| ne doit jamais diminuer en s’approchant (z↓). */
export function sceneryAbsCenterDelta(
  side: -1 | 1,
  z: number,
  maxZ: number,
  centerX: number,
  horizonY: number,
  playerY: number,
  nearHalf: number,
  farHalf: number,
  lateralMul: number,
  marginPx = 0,
): number {
  const x = projectSceneryX(
    side,
    z,
    maxZ,
    centerX,
    horizonY,
    playerY,
    nearHalf,
    farHalf,
    lateralMul,
    marginPx,
  );
  return Math.abs(x - centerX);
}
