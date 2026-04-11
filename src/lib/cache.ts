type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

export class TTLCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  async remember<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const existing = this.store.get(key) as CacheEntry<T> | undefined;
    const now = Date.now();

    if (existing && existing.expiresAt > now) {
      return existing.value;
    }

    const value = factory().catch((error) => {
      this.store.delete(key);
      throw error;
    });

    this.store.set(key, {
      expiresAt: now + ttlMs,
      value,
    });

    return value;
  }

  peek<T>(key: string): Promise<T> | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    return entry?.value;
  }

  clear(key: string): void {
    this.store.delete(key);
  }

  clearAll(): void {
    this.store.clear();
  }
}
