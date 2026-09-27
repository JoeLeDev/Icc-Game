/** Collection ordonnée d'entités de partie et cycle de destruction centralisé. */
export class EntityManager<T> {
  private readonly values: T[] = [];

  constructor(private readonly dispose: (entity: T) => void = () => undefined) {}

  get items(): readonly T[] {
    return this.values;
  }

  get count(): number {
    return this.values.length;
  }

  add(entity: T): T {
    this.values.push(entity);
    return entity;
  }

  remove(index: number): void {
    const entity = this.values[index];
    if (!entity) return;
    this.dispose(entity);
    this.values.splice(index, 1);
  }

  clear(): void {
    for (const entity of this.values) this.dispose(entity);
    this.values.length = 0;
  }

  forEachReverse(run: (entity: T, index: number) => void): void {
    for (let index = this.values.length - 1; index >= 0; index--) {
      const entity = this.values[index];
      if (entity) run(entity, index);
    }
  }
}
