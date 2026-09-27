import type Phaser from 'phaser';
import { button, screen } from '../ui/Screen';

export class PauseOverlay {
  private ui: ReturnType<typeof screen> | null = null;
  constructor(
    private readonly scene: Phaser.Scene,
    _width: number,
    _height: number,
    private readonly actions: { resume(): void; restart(): void; home(): void },
  ) {}

  // CSS follows viewport changes, including safe areas, without rebuilding.
  applyLayout(): void {}

  setVisible(visible: boolean): void {
    if (!visible) {
      this.ui?.destroy();
      this.ui = null;
      this.scene.game.canvas.focus();
      return;
    }
    if (this.ui) return;
    this.ui = screen(this.scene, 'PAUSE');
    button(this.ui.actions, 'REPRENDRE', this.actions.resume);
    button(this.ui.actions, 'RECOMMENCER', this.actions.restart, true);
    button(this.ui.actions, 'ACCUEIL', this.actions.home, true);
    this.ui.root.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); this.actions.resume(); }
    });
  }
}
