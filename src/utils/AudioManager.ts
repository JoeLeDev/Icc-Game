import { Storage } from './Storage';

/** Sons synthétiques légers (Web Audio) — pas d'assets audio externes */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  constructor() {
    this.enabled = Storage.getSoundEnabled();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    Storage.setSoundEnabled(on);
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, slide = 0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  ui(): void {
    this.tone(660, 0.08, 'triangle', 0.05);
  }

  collect(): void {
    this.tone(880, 0.12, 'sine', 0.09, 400);
    this.tone(1320, 0.18, 'triangle', 0.05);
  }

  love(): void {
    this.tone(523, 0.2, 'sine', 0.08);
    this.tone(659, 0.25, 'sine', 0.07);
    this.tone(784, 0.35, 'triangle', 0.06);
  }

  hit(): void {
    this.tone(180, 0.25, 'sawtooth', 0.07, -100);
  }

  bonus(): void {
    this.tone(740, 0.1, 'square', 0.04, 200);
  }

  win(): void {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.28, 'triangle', 0.07), i * 120);
    });
  }

  lose(): void {
    this.tone(300, 0.4, 'sawtooth', 0.05, -200);
  }

  countdown(): void {
    this.tone(440, 0.12, 'square', 0.05);
  }

  go(): void {
    this.tone(880, 0.2, 'square', 0.06);
  }
}

export const audio = new AudioManager();
