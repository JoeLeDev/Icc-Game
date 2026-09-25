import { expect, test } from '@playwright/test';

test('le menu démarre une partie et la pause répond au clavier', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => window.__khayilGame?.scene.isActive('Menu'))).toBe(true);

  await page.mouse.click(195, 591);
  await expect.poll(() => page.evaluate(() => window.__khayilGame?.scene.isActive('Game'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { paused?: boolean }).paused)).toBe(true);
});

test('les flèches changent la voie après le décompte', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__khayilGame?.scene.isActive('Menu'))).toBe(true);
  await page.mouse.click(195, 591);
  await expect.poll(() => page.evaluate(() => window.__khayilGame?.scene.isActive('Game'))).toBe(true);

  await expect.poll(
    () => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { playing?: boolean }).playing),
    { timeout: 6_000 },
  ).toBe(true);
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { lane?: number }).lane)).toBe(1);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { lane?: number }).lane)).toBe(2);
});

test('le viewport de gameplay reste plafonné sur desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__khayilGame?.scene.isActive('Menu'))).toBe(true);
  await page.mouse.click(640, 504);
  await expect.poll(() => page.evaluate(() => window.__khayilGame?.scene.isActive('Game'))).toBe(true);

  const layout = await page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as {
    layout?: { gameWidth?: number; browserWidth?: number; hasSideDressing?: boolean };
  }).layout);
  expect(layout).toMatchObject({ browserWidth: 1280, gameWidth: 640, hasSideDressing: true });
});
