import Phaser from 'phaser';
import { DIFFICULTY_IDS, DIFFICULTY_PRESETS, type DifficultyId } from '../config/difficulty';
import { gradeForScore } from '../config/scoring';
import { tryLoadDeferredDecor } from '../systems/AssetFactory';
import { audio } from '../utils/AudioManager';
import { Storage } from '../utils/Storage';
import { button, element, picture, screen } from '../ui/Screen';
import '../ui/menu.css';

/** Decorative inline icons: accessible button names remain their existing text. */
function actionIcon(target: HTMLButtonElement, kind: 'book' | 'trophy'): void {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('menu-action-icon');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', kind === 'book'
    ? 'M12 5v15M12 5C9 3 5 3 2 4v14c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z'
    : 'M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-4 1h8');
  svg.append(path);
  target.prepend(svg);
}

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
    const nameField = element('label', '', 'menu-player-name');
    nameField.append(element('span', 'Ton pseudo'));
    const nameInput = element('input');
    nameInput.type = 'text';
    nameInput.maxLength = 16;
    nameInput.setAttribute('autocomplete', 'nickname');
    nameInput.placeholder = 'Joueuse';
    nameInput.value = Storage.getPlayerName() === 'Joueuse' ? '' : Storage.getPlayerName();
    nameInput.setAttribute('aria-label', 'Pseudo pour le classement local');
    nameInput.addEventListener('change', () => {
      Storage.setPlayerName(nameInput.value);
    });
    nameInput.addEventListener('blur', () => {
      const saved = Storage.setPlayerName(nameInput.value);
      if (nameInput.value.trim()) nameInput.value = saved;
    });
    nameField.append(nameInput);
    ui.content.append(nameField);
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
      Storage.setPlayerName(nameInput.value);
      this.starting = true;
      audio.ui();
      this.scene.start('Prepare');
    });
    play.setAttribute('aria-label', 'JOUER');
    actionIcon(button(ui.actions, 'Comment jouer', () => { audio.ui(); this.scene.start('Tutorial'); }, true), 'book');
    actionIcon(button(ui.actions, 'Classement local', () => this.showLeaderboard(ui.root), true), 'trophy');
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
    dialog.append(
      element('h2', 'Classement des joueuses'),
      element('p', 'Top 10 par difficulté, enregistré uniquement sur cet appareil.'),
    );
    const guide = element('section', '', 'leaderboard-guide');
    guide.setAttribute('aria-label', 'Comment lire le classement');
    guide.append(
      element('h3', 'Comment lire le classement'),
      element('p', 'Les joueuses sont classées selon le total de points obtenu pendant leur partie.'),
    );
    const guideList = element('dl', '', 'leaderboard-guide-list');
    const explanations: [string, string][] = [
      ['Points', 'Score total de la partie : distance, doutes dissipés, esquives, équipements et bonus.'],
      ['Distance', 'Nombre de mètres parcourus avant la fin de la partie.'],
      ['Équipement récupéré', 'Éléments uniques récupérés sur les 7 nécessaires pour la conquête finale.'],
      ['Note finale', 'Lettre attribuée au score total : elle résume la performance de la partie.'],
    ];
    explanations.forEach(([term, description]) => {
      guideList.append(element('dt', term), element('dd', description));
    });
    guide.append(guideList);
    dialog.append(guide);
    const label = element('label', 'Difficulté ');
    const filter = element('select');
    filter.setAttribute('aria-label', 'Difficulté du classement');
    for (const [value, title] of [
      ...DIFFICULTY_IDS.map((id) => [id, DIFFICULTY_PRESETS[id].label]),
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
    list.setAttribute('aria-label', 'Classement');
    const render = (): void => {
      list.replaceChildren();
      const entries = Storage.getLeaderboard(filter.value as DifficultyId | 'legacy');
      if (!entries.length) {
        list.append(element('li', 'Aucune partie enregistrée — joue pour apparaître ici !'));
        return;
      }
      entries.forEach((entry, i) => {
        const row = element('li', '', 'leaderboard-row');
        const rank = element('span', `${i + 1}.`, 'leaderboard-rank');
        const who = element('strong', entry.name || 'Joueuse', 'leaderboard-name');
        const total = entry.score ?? entry.distance;
        const grade = entry.grade ?? gradeForScore(total).grade;
        const gradeLabel = gradeForScore(total).label;
        const stats = element('dl', '', 'leaderboard-stats');
        const metrics: [string, string][] = [
          ['Points', `${total} pts`],
          ['Distance', `${entry.distance} m`],
          ['Équipement récupéré', `${entry.equipment}/7`],
          ['Note finale', `${grade} — ${gradeLabel}`],
        ];
        metrics.forEach(([label, value]) => {
          const metric = element('div', '', 'leaderboard-metric');
          metric.append(element('dt', label), element('dd', value));
          stats.append(metric);
        });
        if (entry.love) stats.append(element('p', 'Bonus Amour récupéré ❤', 'leaderboard-bonus'));
        row.append(rank, who, stats);
        list.append(row);
      });
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
