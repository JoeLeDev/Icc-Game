import Phaser from 'phaser';
import { prepareGameAssets } from '../systems/AssetFactory';
import { button, screen } from '../ui/Screen';

/** The only gateway to gameplay, including retries and tutorial launches. */
export class PrepareScene extends Phaser.Scene {
  private generation = 0;
  constructor() { super('Prepare'); }

  create(): void {
    const generation = ++this.generation;
    this.events.once('shutdown', () => ++this.generation);
    const ui = screen(this, 'Préparation de la partie');
    let busy = false;
    const start = (): void => {
      if (generation !== this.generation) return;
      ++this.generation;
      this.scene.start('Game');
    };
    const retry = button(ui.actions, 'Réessayer le chargement', () => void load());
    const fallback = button(ui.actions, 'Jouer avec les visuels simplifiés', start, true);
    button(ui.actions, 'Accueil', () => { ++this.generation; this.scene.start('Menu'); }, true);
    const load = async (): Promise<void> => {
      if (busy || generation !== this.generation) return;
      busy = true;
      retry.hidden = true;
      fallback.hidden = true;
      ui.status.textContent = 'Chargement des décors et des équipements…';
      let ready = false;
      try { ready = await prepareGameAssets(this); } catch { /* Offer retry or procedural fallback. */ }
      if (generation !== this.generation) return;
      busy = false;
      if (ready) { start(); return; }
      ui.status.textContent = 'Certains visuels n’ont pas pu être chargés. Réessaie ou joue avec les visuels disponibles.';
      retry.hidden = false;
      fallback.hidden = false;
      retry.focus();
    };
    void load();
  }
}
