import type Phaser from 'phaser';
interface ActiveEffectView {
  id: string;
  remaining: number;
}

export interface HudPresenterTargets {
  hearts: Phaser.GameObjects.Image[];
  distance: Phaser.GameObjects.Text;
  effects: Phaser.GameObjects.Text;
}

/** Projection sans logique de jeu des valeurs d'une partie vers le HUD. */
export class HudPresenter {
  constructor(private readonly targets: HudPresenterTargets) {}

  setScore(distance: number, score: number): void {
    this.targets.distance.setText(`${Math.floor(distance)} M · ${score} pts`);
  }

  setHearts(lives: number): void {
    this.targets.hearts.forEach((heart, index) => heart.setTexture(index < lives ? 'heart' : 'heart-empty'));
  }

  setEffects(effects: ActiveEffectView[], hasShield: boolean, invincibility: number, hasLove: boolean): void {
    const labels: Record<string, string> = { magnet: 'Aimant', slowmo: 'Ralenti', boost: 'Boost', love: 'Amour' };
    const parts = effects.flatMap((effect) => labels[effect.id] ? [`${labels[effect.id]} ${Math.ceil(effect.remaining)}s`] : []);
    if (hasShield) parts.push('Bouclier');
    if (invincibility > 0.15 && !hasLove) parts.push(`Invuln. ${invincibility.toFixed(1)}s`);
    this.targets.effects.setText(parts.join(' · '));
  }
}
