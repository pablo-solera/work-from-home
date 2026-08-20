export type BatchLoader<K, V> = (keys: K[]) => Promise<Map<K, V>>;

export class TtlCache<K, V> {
  private readonly entries = new Map<K, { expiresAt: number; value: V }>();
  private loading: Promise<void> | null = null;

  async get(key: K, loader: BatchLoader<K, V>, ttl: (value: V) => number): Promise<V> {
    const values = await this.getMany([key], loader, ttl);
    return values.get(key)!;
  }

  async getMany(keys: K[], loader: BatchLoader<K, V>, ttl: (value: V) => number): Promise<Map<K, V>> {
    const uniqueKeys = [...new Set(keys)];
    if (this.loading) await this.loading;

    const now = Date.now();
    const missingKeys = uniqueKeys.filter((key) => {
      const entry = this.entries.get(key);
      return !entry || entry.expiresAt <= now;
    });

    if (missingKeys.length > 0) {
      const load = loader(missingKeys).then((values) => {
        const loadedAt = Date.now();
        for (const key of missingKeys) {
          const value = values.get(key);
          if (value !== undefined) this.entries.set(key, { value, expiresAt: loadedAt + ttl(value) });
        }
      });
      this.loading = load.finally(() => {
        this.loading = null;
      });
      await this.loading;
      return this.getMany(uniqueKeys, loader, ttl);
    }

    return new Map(uniqueKeys.map((key) => [key, this.entries.get(key)!.value]));
  }
}
