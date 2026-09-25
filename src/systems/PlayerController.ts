import Phaser from 'phaser';

export interface PlayerControllerCallbacks {
  canControl(): boolean;
  canPauseOnHidden(): boolean;
  isHudControl(pointer: Phaser.Input.Pointer): boolean;
  moveLane(direction: -1 | 1): void;
  togglePause(): void;
  pause(): void;
}

/** Branche les entrées joueur à une scène sans y mélanger les règles de jeu. */
export class PlayerController {
  private keys: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    esc: Phaser.Input.Keyboard.Key;
  } | null = null;
  private swipeStartX = 0;
  private lastMoveAt = 0;
  private lastPauseAt = 0;

  private readonly onWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    switch (event.code) {
      case 'ArrowLeft': case 'KeyA':
        event.preventDefault(); this.move(-1); break;
      case 'ArrowRight': case 'KeyD':
        event.preventDefault(); this.move(1); break;
      case 'Escape':
        event.preventDefault(); this.togglePause(); break;
    }
  };

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.scene.game.canvas.focus();
    this.swipeStartX = this.callbacks.isHudControl(pointer) ? Number.NaN : pointer.x;
  };

  private readonly onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!this.callbacks.canControl() || Number.isNaN(this.swipeStartX)) return;
    const deltaX = pointer.x - this.swipeStartX;
    if (Math.abs(deltaX) > 40) this.move(deltaX > 0 ? 1 : -1);
  };

  private readonly onVisibility = (): void => {
    if (document.hidden && this.callbacks.canPauseOnHidden()) this.callbacks.pause();
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: PlayerControllerCallbacks,
  ) {}

  attach(): void {
    const canvas = this.scene.game.canvas;
    canvas.setAttribute('tabindex', '0');
    canvas.style.outline = 'none';
    canvas.focus();

    const keyboard = this.scene.input.keyboard;
    if (keyboard) {
      keyboard.enabled = true;
      keyboard.addCapture(KEY_CODES);
      this.keys = {
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false),
        a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
        d: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
        esc: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false),
      };
    }

    window.addEventListener('keydown', this.onWindowKeyDown, { passive: false });
    this.scene.input.on('pointerdown', this.onPointerDown);
    this.scene.input.on('pointerup', this.onPointerUp);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  detach(): void {
    const keyboard = this.scene.input.keyboard;
    if (keyboard && this.keys) {
      keyboard.removeCapture(KEY_CODES);
      Object.values(this.keys).forEach((key) => keyboard.removeKey(key));
      this.keys = null;
    }
    window.removeEventListener('keydown', this.onWindowKeyDown);
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.off('pointerup', this.onPointerUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  update(): void {
    if (!this.keys) return;
    const { left, right, a, d, esc } = this.keys;
    if (Phaser.Input.Keyboard.JustDown(esc)) {
      this.togglePause();
    } else if (this.callbacks.canControl()) {
      if (Phaser.Input.Keyboard.JustDown(left) || Phaser.Input.Keyboard.JustDown(a)) this.move(-1);
      else if (Phaser.Input.Keyboard.JustDown(right) || Phaser.Input.Keyboard.JustDown(d)) this.move(1);
    }
  }

  cancelSwipe(): void {
    this.swipeStartX = Number.NaN;
  }

  private move(direction: -1 | 1): void {
    if (!this.callbacks.canControl()) return;
    const now = performance.now();
    if (now - this.lastMoveAt < 80) return;
    this.lastMoveAt = now;
    this.callbacks.moveLane(direction);
  }

  private togglePause(): void {
    const now = performance.now();
    if (now - this.lastPauseAt < 80) return;
    this.lastPauseAt = now;
    this.callbacks.togglePause();
  }
}

const KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.A,
  Phaser.Input.Keyboard.KeyCodes.D,
  Phaser.Input.Keyboard.KeyCodes.ESC,
];
