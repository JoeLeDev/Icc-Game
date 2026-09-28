import Phaser from 'phaser';
import { DIFFICULTY_IDS, DIFFICULTY_PRESETS, type DifficultyId } from '../config/difficulty';
import { tryLoadDeferredDecor } from '../systems/AssetFactory';
import { audio } from '../utils/AudioManager';
import { Storage } from '../utils/Storage';
import { button, element, picture, screen } from '../ui/Screen';
import '../ui/menu.css';

export class MenuScene extends Phaser.Scene {
  private starting = false;
  constructor() { super('Menu'); }

  create(): void {
    this.starting = false;
    void tryLoadDeferredDecor(this);
    const ui = screen(this, 'KHAYIL 2026', 'menu-screen');
    const backdrop = element('div', '', 'menu-backdrop');
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.append(element('div', '', 'menu-horizon'), element('div', '', 'menu-road'));
    ui.root.prepend(backdrop);
    ui.content.append(element('p', 'ÉQUIPÉE POUR CONQUÉRIR', 'tagline'));
    const stage = element('div', '', 'menu-stage');
    picture(stage, 'assets/player_moto.webp', '', 'hero-moto');
    ui.content.append(stage);
    const best = Storage.getBestDistance();
    const record = element('div', '', 'menu-record');
    const trophy = element('span', '🏆', 'menu-record-icon');
    trophy.setAttribute('aria-hidden', 'true');
    const value = element('div');
    value.append(element('p', 'RECORD LOCAL'), element('strong', `${best} m`));
    record.append(trophy, value);
    stage.append(record);
    const choices = element('fieldset');
    choices.append(element('legend', 'Difficulté'));
    const row = element('div', '', 'choice-row');
    const chips = DIFFICULTY_IDS.map(id => {
      const chip = button(row, DIFFICULTY_PRESETS[id].label, () => {
        Storage.setDifficulty(id);
        chips.forEach((node, i) => node.setAttribute('aria-pressed', String(DIFFICULTY_IDS[i] === id)));
        audio.ui();
      }, true);
      chip.setAttribute('aria-pressed', String(Storage.getDifficulty() === id));
      return chip;
    });
    choices.append(row);
    ui.actions.append(choices);
    const play = button(ui.actions, 'JOUER', () => {
      if (this.starting) return;
      this.starting = true;
      audio.ui();
      this.scene.start('Prepare');
    });
    play.setAttribute('aria-label', 'JOUER');
    button(ui.actions, 'Comment jouer', () => { audio.ui(); this.scene.start('Tutorial'); }, true);
    button(ui.actions, 'Classement local', () => this.showLeaderboard(ui.root), true);
    const settings = element('div', '', 'choice-row menu-settings');
    const sound = button(settings, audio.isEnabled() ? 'Son : activé' : 'Son : coupé', () => {
      const on = audio.toggle();
      sound.textContent = on ? 'Son : activé' : 'Son : coupé';
      sound.setAttribute('aria-pressed', String(on));
    }, true);
    sound.setAttribute('aria-pressed', String(audio.isEnabled()));
    const motion = button(settings, 'Effets réduits', () => {
      const reduced = !Storage.getReducedMotion();
      Storage.setReducedMotion(reduced);
      motion.setAttribute('aria-pressed', String(reduced));
      ui.root.dataset.reducedMotion = String(reduced);
    }, true);
    motion.setAttribute('aria-pressed', String(Storage.getReducedMotion()));
    ui.actions.append(settings);
  }

  private showLeaderboard(root: HTMLElement): void {
    const dialog = element('dialog', '', 'leaderboard');
    dialog.setAttribute('aria-label', 'Classement local');
    dialog.append(element('h2', 'Classement local'), element('p', 'Enregistré uniquement sur cet appareil.'));
    const label = element('label', 'Difficulté ');
    const filter = element('select');
    filter.setAttribute('aria-label', 'Difficulté du classement');
    for (const [value, title] of [
      ...DIFFICULTY_IDS.map(id => [id, DIFFICULTY_PRESETS[id].label]),
      ['legacy', 'Anciennes parties — difficulté inconnue'],
    ]) {
      const option = element('option', title);
      option.value = value;
      filter.append(option);
    }
    filter.value = Storage.getDifficulty();
    label.append(filter);
    dialog.append(label);
    const list = element('ol');
    const render = (): void => {
      list.replaceChildren();
      const entries = Storage.getLeaderboard(filter.value as DifficultyId | 'legacy');
      if (!entries.length) list.append(element('li', 'Aucune partie enregistrée'));
      entries.forEach(entry => list.append(element('li',
        `${entry.score ?? entry.distance} pts · ${entry.distance} m · ${entry.equipment}/7${entry.love ? ' ❤' : ''}`)));
    };
    filter.addEventListener('change', render);
    render();
    dialog.append(list);
    button(dialog, 'Fermer', () => dialog.close(), true);
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    root.append(dialog);
    dialog.showModal();
  }
}
