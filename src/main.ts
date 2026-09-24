import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { TutorialScene } from './scenes/TutorialScene';
import { GameScene } from './scenes/GameScene';
import { VictoryScene } from './scenes/VictoryScene';
import { GameOverScene } from './scenes/GameOverScene';

function viewportSize(): { width: number; height: number } {
  const parent = document.getElementById('game-container');
  const width = parent?.clientWidth || window.innerWidth || 390;
  const height = parent?.clientHeight || window.innerHeight || 844;
  return { width: Math.max(280, width), height: Math.max(480, height) };
}

const initial = viewportSize();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: initial.width,
  height: initial.height,
  backgroundColor: '#0a0618',
  scale: {
    mode: Phaser.Scale.RESIZE,
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

document.addEventListener(
  'touchmove',
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);

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
