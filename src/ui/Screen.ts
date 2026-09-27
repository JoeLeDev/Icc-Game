import type Phaser from 'phaser';
import { Storage } from '../utils/Storage';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

/** Native controls provide keyboard focus, scrolling and responsive safe areas. */
export function screen(scene: Phaser.Scene, title: string, variant = ''): { root: HTMLElement; content: HTMLElement; actions: HTMLElement; status: HTMLElement; destroy(): void } {
  const root = element('section', '', `game-screen ${variant}`);
  root.setAttribute('aria-label', title);
  root.dataset.reducedMotion = String(Storage.getReducedMotion());
  const panel = element('div', '', 'screen-panel');
  const content = element('div', '', 'screen-content');
  const heading = element('h1', title);
  heading.tabIndex = -1;
  content.append(heading);
  const actions = element('nav', '', 'screen-actions');
  actions.setAttribute('aria-label', 'Actions');
  const status = element('p', '', 'screen-status');
  status.setAttribute('role', 'status');
  panel.append(content, actions, status);
  root.append(panel);
  document.getElementById('game-frame')!.append(root);
  const focusTimer = window.setTimeout(() => heading.focus({ preventScroll: true }), 0);
  const stopKeys = (event: KeyboardEvent): void => event.stopPropagation();
  root.addEventListener('keydown', stopKeys);
  const cleanup = (): void => {
    window.clearTimeout(focusTimer);
    root.remove();
    scene.events.off('shutdown', cleanup);
    scene.events.off('destroy', cleanup);
  };
  scene.events.once('shutdown', cleanup);
  scene.events.once('destroy', cleanup);
  return { root, content, actions, status, destroy: cleanup };
}

export function button(parent: HTMLElement, label: string, action: () => void, secondary = false): HTMLButtonElement {
  const node = element('button', label, secondary ? 'secondary' : '');
  node.type = 'button';
  node.addEventListener('click', action);
  parent.append(node);
  return node;
}

export function picture(parent: HTMLElement, source: string, label: string, className = ''): void {
  const image = element('img', '', className);
  image.src = source;
  image.alt = label;
  image.addEventListener('error', () => image.hidden = true, { once: true });
  parent.append(image);
}
