import Phaser from 'phaser';
import { SCORE } from '../config/scoring';
import { button, element, screen } from '../ui/Screen';
import { audio } from '../utils/AudioManager';

export class TutorialScene extends Phaser.Scene {
  constructor() { super('Tutorial'); }
  create(): void {
    const ui = screen(this, 'Comment jouer', 'tutorial-screen');
    const sections = [
      ['Déplacement', 'Swipe ← → ou flèches / A D pour changer de voie. Après un choc ou une attaque sur une moto, tu rebondis sur ta voie précédente.'],
      ['Objectif', 'Récupère les 7 équipements d’Éphésiens 6. Plus tu en as, plus la route s’intensifie. À 7/7 : conquête finale.'],
      ['Dangers', 'Évite les voitures, tonneaux et zones de feu. Les motos ennemies restent à ta hauteur et tirent toutes les 3 secondes. Deux coups de flanc les vainquent ; chaque coup repousse leur tir. Un choc arrière te blesse uniquement : la moto adverse reste intacte.'],
      ['Doutes (?)', `Passe dessus pour les dissiper : +${SCORE.perDoubt} points. Ils améliorent ta note finale.`],
      ['Bonus et Amour', 'Bouclier, vie, aimant, ralenti et boost t’aident. L’Amour ❤ donne une invulnérabilité temporaire totale.'],
      ['Score et commandes', 'Distance, doutes, esquives et équipements contribuent au score. Échap met la partie en pause. Dans les menus, utilise Tab puis Entrée ou Espace.'],
    ];
    const sectionsRoot = element('div', '', 'tutorial-sections');
    for (const [title, text] of sections) {
      const section = element('section');
      section.append(element('h2', title), element('p', text));
      sectionsRoot.append(section);
    }
    ui.content.append(sectionsRoot);
    button(ui.actions, 'JOUER', () => { audio.ui(); this.scene.start('Prepare'); });
    button(ui.actions, 'Accueil', () => this.scene.start('Menu'), true);
  }
}
