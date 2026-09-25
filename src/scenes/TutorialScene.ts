import Phaser from 'phaser';
import { EQUIPMENTS } from '../config/gameConfig';
import { SCORE } from '../config/scoring';
import { computeLayout, readSafeAreaInsets, setCurrentLayout } from '../config/responsiveLayout';
import { applyDisplayBox, applyHudEquipmentIcon } from '../systems/SpriteDisplay';
import { audio } from '../utils/AudioManager';

export class TutorialScene extends Phaser.Scene {
  constructor() {
    super('Tutorial');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const layout = computeLayout(W, H, readSafeAreaInsets());
    setCurrentLayout(layout);

    this.add.rectangle(W / 2, H / 2, W, H, 0x070412, 0.96);

    this.add
      .text(W / 2, layout.padTop + 36, 'COMMENT JOUER', {
        fontFamily: 'Orbitron',
        fontSize: '20px',
        color: '#ff2d95',
      })
      .setOrigin(0.5);

    const sections: { title: string; body: string }[] = [
      {
        title: 'Déplacement',
        body: 'Swipe ← → ou flèches / A D pour changer de voie. Après un choc ou une attaque sur une moto, tu rebondis sur ta voie précédente.',
      },
      {
        title: 'Objectif',
        body: 'Récupère les 7 équipements d’Éphésiens 6. Plus tu en as, plus la route s’intensifie. À 7/7 : conquête finale.',
      },
      {
        title: 'Dangers',
        body: 'Voitures, tonneaux, colère, rejet (voie fermée). Les motos ennemies (dépression / peur) restent à ta hauteur, te tirent dessus toutes les 2 s, et se vainquent avec 2 coups de flanc.',
      },
      {
        title: 'Doutes (?)',
        body: `Passe dessus pour les dissiper : +${SCORE.perDoubt} pts. Ils améliorent ton score et ta note finale (S à E).`,
      },
      {
        title: 'Bonus & Amour',
        body: 'Bouclier, vie, aimant, ralenti, boost. L’Amour ❤ est rare : invulnérabilité temporaire totale.',
      },
      {
        title: 'Score & note',
        body: 'Distance, doutes, esquives, équipements et Amour font ton score. En fin de partie tu reçois une note (Conquérante → À relever).',
      },
    ];

    let y = layout.padTop + 70;
    for (const s of sections) {
      this.add
        .text(28, y, s.title, {
          fontFamily: 'Orbitron',
          fontSize: '12px',
          color: '#00e5ff',
        })
        .setOrigin(0, 0);
      y += 18;
      const body = this.add
        .text(28, y, s.body, {
          fontFamily: 'Outfit',
          fontSize: '12px',
          color: '#e1bee7',
          wordWrap: { width: W - 56 },
          lineSpacing: 3,
        })
        .setOrigin(0, 0);
      y += body.height + 14;
    }

    EQUIPMENTS.forEach((eq, i) => {
      const icon = this.add.image(36 + i * 44, H - layout.padBottom - 108, `eq-icon-${eq.id}`);
      applyHudEquipmentIcon(icon);
    });
    const love = this.add.image(W - 36, H - layout.padBottom - 108, 'love');
    applyDisplayBox(love, layout.hudIconSize);

    const play = this.add
      .rectangle(W / 2, H - layout.padBottom - 48, 200, 44, 0x9b59ff)
      .setStrokeStyle(2, 0xff2d95)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(W / 2, H - layout.padBottom - 48, 'JOUER', {
        fontFamily: 'Orbitron',
        fontSize: '16px',
        color: '#fff',
      })
      .setOrigin(0.5);
    play.on('pointerdown', () => {
      audio.ui();
      this.scene.start('Game');
    });

    const back = this.add
      .text(28, layout.padTop + 8, '←', { fontSize: '26px', color: '#fff' })
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      audio.ui();
      this.scene.start('Menu');
    });
  }
}
