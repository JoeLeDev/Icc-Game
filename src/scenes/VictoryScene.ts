import Phaser from 'phaser';
import { endScreen, type EndData } from '../ui/EndScreen';
export class VictoryScene extends Phaser.Scene {
  constructor() { super('Victory'); }
  create(data: EndData): void { endScreen(this, data, true); }
}
