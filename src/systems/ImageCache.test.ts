import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageCache } from './ImageCache';

afterEach(() => vi.useRealTimers());
describe('ImageCache', () => {
  function setup() {
    const images: HTMLImageElement[] = [];
    const factory = () => {
      const image = { src: '', onload: null, onerror: null } as unknown as HTMLImageElement;
      images.push(image);
      return image;
    };
    return { cache: new ImageCache(100, factory), images };
  }
  it('shares downloads and caches successful images', async () => {
    const { cache, images } = setup();
    const first = cache.load('a');
    expect(cache.load('a')).toBe(first);
    images[0].onload!(new Event('load'));
    expect(await first).toBe(images[0]);
    expect(await cache.load('a')).toBe(images[0]);
    expect(images).toHaveLength(1);
  });
  it('evicts failed downloads so they can be retried', async () => {
    const { cache, images } = setup();
    const first = cache.load('a');
    images[0].onerror!(new Event('error'));
    expect(await first).toBeNull();
    const second = cache.load('a');
    expect(images).toHaveLength(2);
    images[1].onload!(new Event('load'));
    expect(await second).toBe(images[1]);
  });
  it('bounds stalled requests and detaches late callbacks', async () => {
    vi.useFakeTimers();
    const { cache, images } = setup();
    const first = cache.load('a');
    await vi.advanceTimersByTimeAsync(100);
    expect(await first).toBeNull();
    expect(images[0].onload).toBeNull();
    expect(images[0].src).toBe('');
  });
});
