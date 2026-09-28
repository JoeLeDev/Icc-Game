import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { BoostVisuals } from './BoostVisuals';

function fixture() {
  const graphics = {
    setVisible: vi.fn().mockReturnThis(), clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(), fillTriangle: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(), lineBetween: vi.fn().mockReturnThis(),
  };
  const scene = { add: { graphics: () => graphics } } as unknown as Phaser.Scene;
  return { graphics, visual: new BoostVisuals(scene) };
}

describe('BoostVisuals', () => {
  it('hides inactive effects and draws a bounded number of jets and streaks', () => {
    const { graphics, visual } = fixture();
    visual.update(.016, false, false, 50, 80);
    expect(graphics.clear).not.toHaveBeenCalled();
    visual.update(.016, true, false, 50, 80);
    expect(graphics.fillTriangle).toHaveBeenCalledTimes(6);
    expect(graphics.lineBetween).toHaveBeenCalledTimes(6);
    visual.update(.016, false, false, 50, 80);
    expect(graphics.setVisible).toHaveBeenLastCalledWith(false);
  });
  it('keeps reduced-motion jets static with no speed streaks', () => {
    const { graphics, visual } = fixture();
    visual.update(.016, true, true, 50, 80);
    const first = graphics.fillTriangle.mock.calls.slice();
    graphics.fillTriangle.mockClear();
    visual.update(2, true, true, 50, 80);
    expect(graphics.fillTriangle.mock.calls).toEqual(first);
    expect(graphics.lineBetween).not.toHaveBeenCalled();
  });
});
