import { expect, test, type Page } from '@playwright/test';

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on('pageerror', error => errors.get(page)!.push(error.message));
});
test.afterEach(async ({ page }) => { expect(errors.get(page), 'unexpected JavaScript errors').toEqual([]); });

async function active(page: Page, name: string): Promise<void> {
  await expect.poll(() => page.evaluate(name => window.__khayilGame?.scene.isActive(name), name)).toBe(true);
}
async function menu(page: Page): Promise<void> {
  await page.goto('/');
  await active(page, 'Menu');
}
async function play(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'JOUER', exact: true }).click();
  await active(page, 'Game');
}
async function finish(page: Page, won: boolean): Promise<void> {
  await page.evaluate(won => {
    const game = window.__khayilGame?.scene.getScene('Game') as unknown as { endGame(won: boolean): void; loveCollected: boolean };
    game.loveCollected = true;
    game.endGame(won);
  }, won);
  await active(page, won ? 'Victory' : 'GameOver');
}
async function assertActions(page: Page): Promise<void> {
  const padding = await page.locator('.game-screen').evaluate(root => {
    const style = getComputedStyle(root);
    return { top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom), left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) };
  });
  const actions = page.locator('.screen-actions > button');
  const bounds = await actions.evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height };
  }));
  for (let i = 0; i < bounds.length; i++) {
    expect(bounds[i].height).toBeGreaterThanOrEqual(44);
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i], b = bounds[j];
      expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true);
    }
  }
  for (const action of await actions.all()) {
    await action.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await expect(action).toBeInViewport();
    const b = await action.boundingBox();
    expect(b!.x).toBeGreaterThanOrEqual(padding.left - 1);
    expect(b!.x + b!.width).toBeLessThanOrEqual(page.viewportSize()!.width - padding.right + 1);
    expect(b!.y).toBeGreaterThanOrEqual(padding.top - 1);
    expect(b!.y + b!.height).toBeLessThanOrEqual(page.viewportSize()!.height - padding.bottom + 1);
  }
}

test('deux parties successives après un retour à l’accueil', async ({ page }) => {
  await menu(page);
  await page.getByRole('button', { name: 'JOUER', exact: true }).tap();
  await active(page, 'Game');
  await finish(page, false);
  await page.getByRole('button', { name: 'ACCUEIL', exact: true }).click();
  await active(page, 'Menu');
  await play(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { paused?: boolean }).paused)).toBe(true);
  await page.getByRole('button', { name: 'REPRENDRE', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { paused?: boolean }).paused)).toBe(false);
});

test('le tutoriel attend les sprites avant de démarrer', async ({ page }) => {
  let requested = false;
  await page.route('**/assets/car.webp', async route => {
    requested = true;
    await new Promise(resolve => setTimeout(resolve, 600));
    await route.continue();
  });
  await menu(page);
  await page.getByRole('button', { name: 'Comment jouer' }).click();
  await page.getByRole('button', { name: 'JOUER', exact: true }).click();
  await active(page, 'Prepare');
  await expect(page.getByRole('status')).toContainText('Chargement');
  await active(page, 'Game');
  expect(requested).toBe(true);
  const installed = await page.evaluate(() => {
    const source = window.__khayilGame?.textures.get('car').getSourceImage();
    return source instanceof HTMLImageElement && source.src.endsWith('car.webp');
  });
  expect(installed).toBe(true);
});

test('un échec réseau peut être retenté', async ({ page }) => {
  await page.route('**/assets/car.webp', route => route.abort());
  await menu(page);
  await page.getByRole('button', { name: 'JOUER', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Réessayer le chargement' })).toBeVisible();
  await page.unroute('**/assets/car.webp');
  await page.getByRole('button', { name: 'Réessayer le chargement' }).click();
  await active(page, 'Game');
});

test('le mode simplifié permet de jouer après un échec', async ({ page }) => {
  await page.route('**/assets/car.webp', route => route.abort());
  await menu(page);
  await page.getByRole('button', { name: 'JOUER', exact: true }).click();
  await page.getByRole('button', { name: 'Jouer avec les visuels simplifiés' }).click();
  await active(page, 'Game');
});

test('quitter un chargement annule sa transition sans remplacer les textures actives', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => release = resolve);
  await page.route('**/assets/car.webp', async route => { await gate; await route.continue(); });
  await menu(page);
  await page.getByRole('button', { name: 'JOUER', exact: true }).click();
  await active(page, 'Prepare');
  await page.getByRole('button', { name: 'Accueil', exact: true }).click();
  await active(page, 'Menu');
  release();
  await page.waitForTimeout(500);
  await active(page, 'Menu');
  await play(page);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 480 }, { width: 568, height: 320 }]) {
  for (const won of [false, true]) {
    test(`fin ${won ? 'victoire' : 'défaite'} responsive ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await menu(page);
      await play(page);
      await finish(page, won);
      await assertActions(page);
      await page.getByText('Détail des points', { exact: true }).click();
      await expect(page.locator('.score-breakdown')).toBeVisible();
      await assertActions(page);
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      await assertActions(page);
      await page.getByRole('button', { name: 'ACCUEIL', exact: true }).click();
      await active(page, 'Menu');
    });
  }
}

test('safe areas et tutoriel restent accessibles après rotation', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await menu(page);
  await page.addStyleTag({ content: ':root { --safe-top: 24px; --safe-bottom: 34px; --safe-left: 44px; --safe-right: 44px; }' });
  await assertActions(page);
  await page.getByRole('button', { name: 'Comment jouer' }).click();
  await active(page, 'Tutorial');
  await assertActions(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await assertActions(page);
});

test('clavier, effets réduits et classements par difficulté', async ({ page, browserName }) => {
  await menu(page);
  await expect(page.getByRole('heading', { name: 'KHAYIL 2026' })).toBeFocused();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.getByRole('button', { name: 'Facile', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Effets réduits' }).click();
  await expect(page.getByRole('button', { name: 'Effets réduits' })).toHaveAttribute('aria-pressed', 'true');
  await play(page);
  await finish(page, true);
  await expect(page.getByText('Difficulté : Facile')).toBeVisible();
  await page.getByRole('button', { name: 'ACCUEIL', exact: true }).click();
  await page.getByRole('button', { name: 'Classement local' }).click();
  await expect(page.getByRole('dialog').locator('li')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Difficulté du classement' }).selectOption('hard');
  await expect(page.getByRole('dialog')).toContainText('Aucune partie enregistrée');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Effets réduits' })).toHaveAttribute('aria-pressed', 'true');
});

test('les flèches changent la voie après le décompte', async ({ page }) => {
  await menu(page); await play(page);
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { playing?: boolean }).playing)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { lane?: number }).lane)).toBe(2);
});

test('la partie se met en pause en arrière-plan', async ({ page }) => {
  await menu(page); await play(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { paused?: boolean }).paused)).toBe(true);
});

test('le viewport de gameplay reste plafonné sur desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await menu(page); await play(page);
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { layout?: { gameWidth?: number; browserWidth?: number } }).layout))
    .toMatchObject({ browserWidth: 1280, gameWidth: 640 });
});

for (const difficulty of ['Facile', 'Normal', 'Difficile']) {
  test(`les premiers obstacles alternent au centre, à gauche et à droite en ${difficulty}`, async ({ page }) => {
    await menu(page);
    await page.getByRole('button', { name: difficulty, exact: true }).click();
    await play(page);
    await expect.poll(() => page.evaluate(() => {
      const game = window.__khayilGame?.scene.getScene('Game') as unknown as {
        obstacleDistributor: { recentObstacleLanes: number[] };
      };
      return game.obstacleDistributor.recentObstacleLanes.slice(0, 3);
    }), { timeout: 12000 }).toEqual([1, 0, 2]);
  });
}

test('un geste tactile change de voie', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch injection is Chromium-only; WebKit covers native touch taps.');
  await menu(page);
  await page.getByRole('button', { name: 'JOUER', exact: true }).tap();
  await active(page, 'Game');
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { playing?: boolean }).playing)).toBe(true);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 620 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: 620 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { lane?: number }).lane)).toBe(0);
});
