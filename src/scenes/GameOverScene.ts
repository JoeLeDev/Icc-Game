import Phaser from 'phaser';
import { endScreen, type EndData } from '../ui/EndScreen';
export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }
  create(data: EndData): void { endScreen(this, data, false); }
}
