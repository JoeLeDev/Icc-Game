/** Downloads are bounded, shared, and retryable after failure. */
export class ImageCache {
  private readonly pending = new Map<string, Promise<HTMLImageElement | null>>();

  constructor(private readonly timeoutMs = 8000, private readonly createImage = () => new Image()) {}

  load(path: string): Promise<HTMLImageElement | null> {
    const existing = this.pending.get(path);
    if (existing) return existing;
    const promise = new Promise<HTMLImageElement | null>((resolve) => {
      const image = this.createImage();
      const finish = (result: HTMLImageElement | null): void => {
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        if (!result) image.src = '';
        resolve(result);
      };
      const timer = setTimeout(() => finish(null), this.timeoutMs);
      image.onload = () => finish(image);
      image.onerror = () => finish(null);
      image.src = path;
    });
    this.pending.set(path, promise);
    void promise.then((image) => {
      if (!image && this.pending.get(path) === promise) this.pending.delete(path);
    });
    return promise;
  }
}
