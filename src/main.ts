import Phaser from 'phaser';
import { GAME_H, GAME_W } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { TutorialScene } from './scenes/TutorialScene';
import { GameScene } from './scenes/GameScene';
import { VictoryScene } from './scenes/VictoryScene';
import { GameOverScene } from './scenes/GameOverScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0a0618',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,
    keyboard: {
      target: window,
    },
  },
  autoFocus: true,
  scene: [BootScene, MenuScene, TutorialScene, GameScene, VictoryScene, GameOverScene],
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
  audio: {
    disableWebAudio: false,
  },
};

// Prevent pull-to-refresh / page scroll on mobile
document.addEventListener(
  'touchmove',
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);

// Les flèches du clavier déplacent la moto, pas la page
window.addEventListener(
  'keydown',
  (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
      e.preventDefault();
    }
  },
  { passive: false },
);

declare global {
  interface Window {
    __khayilGame?: Phaser.Game;
  }
}

const game = new Phaser.Game(config);
window.__khayilGame = game;
