import { expect, test, type Page } from '@playwright/test';
import type { LaneEntity } from '../../src/systems/EntityTypes';
import type { EntityManager } from '../../src/systems/EntityManager';

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
async function waitForPlaying(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const game = window.__khayilGame?.scene.getScene('Game') as {
      playing?: boolean; paused?: boolean; countdownActive?: boolean;
    };
    return { playing: game?.playing, paused: game?.paused, countdown: game?.countdownActive, hidden: document.hidden };
  }), { message: 'Le décompte doit se terminer dans une page visible, sans pause.' })
    .toEqual({ playing: true, paused: false, countdown: false, hidden: false });
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
  const downloaded = page.waitForResponse(response => response.url().endsWith('/assets/car.webp'));
  release();
  await (await downloaded).finished();
  await active(page, 'Menu');
  await play(page);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 480 }, { width: 568, height: 320 }]) {
  test(`menu complet sans débordement ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('khayil2026_best', '2821'));
    await menu(page);
    await expect(page.locator('.menu-record')).toContainText('2821 m');
    await expect(page.locator('.hero-moto')).toBeVisible();
    for (const difficulty of ['Facile', 'Normal', 'Difficile']) {
      const choice = page.getByRole('button', { name: difficulty, exact: true });
      await choice.click();
      await expect(choice).toHaveAttribute('aria-pressed', 'true');
    }
    const sound = page.getByRole('button', { name: 'Son :' });
    await sound.click();
    await expect(sound).toHaveText('Son : coupé');
    await page.reload();
    await active(page, 'Menu');
    await expect(page.getByRole('button', { name: 'Son : coupé' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Difficile', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const geometry = await page.locator('.menu-screen').evaluate(root => ({ width: root.clientWidth, scrollWidth: root.scrollWidth, height: root.clientHeight, scrollHeight: root.scrollHeight }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height + 1);
    for (const control of await page.locator('.menu-screen button').all()) {
      await expect(control).toBeInViewport({ ratio: 1 });
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
    await assertActions(page);
  });
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

for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
  test(`menu desktop aligné ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await menu(page);
    await assertActions(page);
    for (const name of ['Comment jouer', 'Classement local']) {
      const action = page.getByRole('button', { name, exact: true });
      await expect(action.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      await expect(action).toBeInViewport({ ratio: 1 });
    }
    const bounds = await page.locator('.menu-screen').evaluate(root => {
      const hero = root.querySelector('.menu-stage')!.getBoundingClientRect();
      const record = root.querySelector('.menu-record')!.getBoundingClientRect();
      const actions = root.querySelector('.screen-actions')!.getBoundingClientRect();
      return { heroRight: hero.right, recordRight: record.right, recordLeft: record.left,
        heroLeft: hero.left, actionsLeft: actions.left, width: root.clientWidth, scrollWidth: root.scrollWidth };
    });
    expect(bounds.recordRight).toBeLessThanOrEqual(bounds.heroRight);
    expect(bounds.recordLeft).toBeGreaterThanOrEqual(bounds.heroLeft);
    expect(bounds.recordRight).toBeLessThan(bounds.actionsLeft);
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
  });
}

test('les animations décoratives du menu respectent les effets réduits', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await menu(page);
  const animations = () => page.locator('.menu-screen').evaluate(root => [
    getComputedStyle(root.querySelector('.hero-moto')!).animationName,
    getComputedStyle(root.querySelector('.menu-stage')!, '::before').animationName,
    getComputedStyle(root.querySelector('.screen-actions > button')!).animationName,
  ]);
  expect(await animations()).toEqual(['menu-idle', 'menu-halo', 'menu-play-glow']);
  await page.getByRole('button', { name: 'Effets réduits' }).click();
  expect(await animations()).toEqual(['none', 'none', 'none']);
  await page.getByRole('button', { name: 'Effets réduits' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await animations()).toEqual(['none', 'none', 'none']);
});

test('les flèches changent la voie après le décompte', async ({ page }) => {
  await menu(page); await play(page);
  await waitForPlaying(page);
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

test('une moto réserve sa voie aux obstacles, dépassements et barrières', async ({ page }) => {
  await menu(page); await play(page);
  const result = await page.evaluate(() => {
    const game = window.__khayilGame!.scene.getScene('Game') as unknown as {
      entityManager: EntityManager<LaneEntity>;
      spawnMotoFoes(kind: string, label: string, color: string): void;
      spawnObstacle(lane: number, z: number): void;
      spawnFromBehind(): void;
      spawnReject(): void;
      closedLane: number | null;
    };
    game.entityManager.clear();
    game.spawnMotoFoes('peur', 'PEUR', '#ffeb3b');
    const lanes = game.entityManager.items.filter(e => e.kind === 'peur').map(e => e.lane);
    for (const lane of lanes) game.spawnObstacle(lane, 410);
    game.spawnFromBehind();
    game.spawnReject();
    const blocked = game.entityManager.items.some(e => e.kind === 'obstacle' && lanes.includes(e.lane));
    const closed = game.closedLane;
    game.entityManager.clear();
    for (const lane of lanes) game.spawnObstacle(lane, 410);
    return { lanes, blocked, closed, released: game.entityManager.items.map(e => e.lane) };
  });
  expect(result.lanes.length).toBeGreaterThan(0);
  expect(result.blocked).toBe(false);
  expect(result.lanes).not.toContain(result.closed);
  expect(result.released).toEqual(result.lanes);
});

test('le bouclier reste visible puis disparaît au choc absorbé', async ({ page }) => {
  await menu(page); await play(page);
  const result = await page.evaluate(() => {
    const game = window.__khayilGame!.scene.getScene('Game') as unknown as {
      collectBonus(id: string, x: number, y: number): void;
      tickInvincibility(): void;
      invincibleRemaining: number; lives: number; hasTempShield: boolean;
      shieldVisuals: { graphics: { visible: boolean; parentContainer: unknown } };
      entityRuntime: { takeHit(x: number, y: number): void };
      player: { x: number; y: number };
    };
    const before = game.shieldVisuals.graphics.visible;
    const lives = game.lives;
    game.collectBonus('shield', game.player.x, game.player.y);
    game.tickInvincibility();
    const during = game.shieldVisuals.graphics.visible;
    const follows = game.shieldVisuals.graphics.parentContainer === game.player;
    game.invincibleRemaining = 0;
    game.entityRuntime.takeHit(game.player.x, game.player.y);
    game.tickInvincibility();
    return { before, during, follows, after: game.shieldVisuals.graphics.visible,
      consumed: !game.hasTempShield, protected: game.lives === lives };
  });
  expect(result).toEqual({ before: false, during: true, follows: true, after: false, consumed: true, protected: true });
});

test('les jets du boost suivent son activation et son expiration', async ({ page }) => {
  await menu(page); await play(page);
  const states = await page.evaluate(() => {
    const game = window.__khayilGame!.scene.getScene('Game') as unknown as {
      addEffect(id: string, duration: number): void;
      tickEffects(dt: number): void;
      boostVisuals: { graphics: { visible: boolean; parentContainer: unknown } };
      player: unknown;
    };
    const before = game.boostVisuals.graphics.visible;
    game.addEffect('boost', 4);
    game.tickEffects(.016);
    const during = game.boostVisuals.graphics.visible;
    const follows = game.boostVisuals.graphics.parentContainer === game.player;
    game.tickEffects(4);
    return { before, during, follows, after: game.boostVisuals.graphics.visible };
  });
  expect(states).toEqual({ before: false, during: true, follows: true, after: false });
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
    // The spawn window starts after the countdown, not when the scene is created.
    await waitForPlaying(page);
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
  await waitForPlaying(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 620 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: 620 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => (window.__khayilGame?.scene.getScene('Game') as { lane?: number }).lane)).toBe(0);
});
