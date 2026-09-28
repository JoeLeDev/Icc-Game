import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { ShieldVisuals } from './ShieldVisuals';

function fixture() {
  const graphics = {
    setVisible: vi.fn().mockReturnThis(), clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(), fillPoints: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(), strokePoints: vi.fn().mockReturnThis(),
  };
  const scene = { add: { graphics: () => graphics } } as unknown as Phaser.Scene;
  return { graphics, visual: new ShieldVisuals(scene) };
}

describe('ShieldVisuals', () => {
  it('shows armor and badge only while the shield is active', () => {
    const { graphics, visual } = fixture();
    visual.update(false, false, 0, 50, 80);
    expect(graphics.clear).not.toHaveBeenCalled();
    visual.update(true, false, 1, 50, 80);
    expect(graphics.setVisible).toHaveBeenLastCalledWith(true);
    expect(graphics.strokePoints).toHaveBeenCalledTimes(3);
    visual.update(false, false, 2, 50, 80);
    expect(graphics.setVisible).toHaveBeenLastCalledWith(false);
  });
  it('remains static with reduced effects and adapts to the player size', () => {
    const { graphics, visual } = fixture();
    visual.update(true, true, 0, 50, 80);
    const first = graphics.strokePoints.mock.calls[0];
    graphics.strokePoints.mockClear();
    visual.update(true, true, 2, 50, 80);
    expect(graphics.strokePoints.mock.calls[0]).toEqual(first);
    graphics.strokePoints.mockClear();
    visual.update(true, true, 2, 100, 160);
    expect(graphics.strokePoints.mock.calls[0]).not.toEqual(first);
  });
});
