import type Phaser from 'phaser';
import { EQUIPMENTS, type EquipmentId } from '../config/gameConfig';
import { DIFFICULTY_PRESETS, type DifficultyId } from '../config/difficulty';
import type { RunScoreResult } from '../config/scoring';
import { Storage } from '../utils/Storage';
import { audio } from '../utils/AudioManager';
import { formatShareText, shareResult } from '../utils/Share';
import { button, element, picture, screen } from './Screen';

export interface EndData {
  won: boolean;
  equipment: number;
  collected: EquipmentId[];
  love: boolean;
  distance: number;
  avoided: number;
  doubts?: number;
  score?: number;
  grade?: string;
  gradeLabel?: string;
  difficulty?: DifficultyId;
  breakdown?: RunScoreResult['breakdown'];
}

export function endScreen(scene: Phaser.Scene, data: EndData, won: boolean): void {
  const ui = screen(scene, won ? 'TU ES ÉQUIPÉE POUR CONQUÉRIR !' : 'GAME OVER', 'end-screen');
  const hero = element('div', '', 'result-hero');
  picture(hero, 'assets/player_moto.webp', '', 'hero-moto');
  hero.append(element('p', won ? 'La conquête est à toi.' : 'Relève-toi. Tu es appelée à conquérir.', 'tagline'));
  ui.content.append(hero);
  const summary = element('section', '', 'result-card');
  summary.setAttribute('aria-label', 'Résultat');
  summary.append(
    element('h2', `Note ${data.grade ?? '—'} · ${data.gradeLabel ?? ''}`),
    element('p', `${data.score ?? 0} points`, 'score'),
    element('p', `${data.distance} m · ${data.equipment}/7 équipements · ${data.avoided ?? 0} esquives`),
    element('p', `Record local : ${Storage.getBestDistance()} m`),
  );
  if (data.difficulty) summary.append(element('p', `Difficulté : ${DIFFICULTY_PRESETS[data.difficulty].label}`));
  if (data.breakdown) {
    const details = element('details');
    details.append(element('summary', 'Détail des points'));
    const list = element('dl', '', 'score-breakdown');
    const labels = { distance: 'Distance', doubts: 'Doutes dissipés', avoided: 'Esquives', equipment: 'Équipements', love: 'Amour', win: 'Victoire' };
    for (const key of Object.keys(labels) as Array<keyof typeof labels>) {
      list.append(element('dt', labels[key]), element('dd', String(data.breakdown[key])));
    }
    details.append(list);
    summary.append(details);
  }
  ui.content.append(summary);
  if (won) {
    const equipment = element('div', '', 'equipment-grid');
    for (const item of EQUIPMENTS) {
      const figure = element('figure');
      const got = data.collected?.includes(item.id);
      figure.className = got ? '' : 'not-collected';
      picture(figure, `assets/eq_${item.id}.webp`, item.name);
      figure.append(element('figcaption', `${item.short}${got ? ' ✓' : ''}`));
      equipment.append(figure);
    }
    if (data.love) {
      const figure = element('figure');
      picture(figure, 'assets/love_heart.webp', 'Amour');
      figure.append(element('figcaption', 'Amour ❤'));
      equipment.append(figure);
    }
    ui.content.append(equipment);
  }
  let leaving = false;
  const go = (target: string): void => {
    if (leaving) return;
    leaving = true;
    audio.ui();
    scene.scene.start(target);
  };
  button(ui.actions, won ? 'REJOUER' : 'RÉESSAYER', () => go('Prepare'));
  const share = button(ui.actions, 'PARTAGER', () => {
    share.disabled = true;
    void shareResult(formatShareText({ ...data, won })).then(result => {
      if (!ui.root.isConnected) return;
      share.disabled = false;
      ui.status.textContent = { shared: 'Partagé !', copied: 'Résultat copié !', cancelled: 'Partage annulé', failed: 'Le partage a échoué. Tu peux réessayer.' }[result];
    });
  }, true);
  button(ui.actions, 'ACCUEIL', () => go('Menu'), true);
}
