export type BatchLoader<K, V> = (keys: K[]) => Promise<Map<K, V>>;

export class TtlCache<K, V> {
  private readonly entries = new Map<K, { expiresAt: number; value: V }>();
  // One in-flight load per key, so a slow load never blocks callers asking for other (or cached) keys.
  private readonly inflight = new Map<K, Promise<void>>();

  async get(key: K, loader: BatchLoader<K, V>, ttl: (value: V) => number): Promise<V> {
    const values = await this.getMany([key], loader, ttl);
    return values.get(key)!;
  }

  async getMany(keys: K[], loader: BatchLoader<K, V>, ttl: (value: V) => number): Promise<Map<K, V>> {
    const uniqueKeys = [...new Set(keys)];
    const now = Date.now();
    const missingKeys = uniqueKeys.filter((key) => {
      const entry = this.entries.get(key);
      return !entry || entry.expiresAt <= now;
    });

    const pending: Promise<void>[] = [];
    const keysToLoad: K[] = [];
    for (const key of missingKeys) {
      const running = this.inflight.get(key);
      if (running) pending.push(running);
      else keysToLoad.push(key);
    }

    if (keysToLoad.length > 0) {
      const load = loader(keysToLoad)
        .then((values) => {
          const loadedAt = Date.now();
          for (const key of keysToLoad) {
            const value = values.get(key);
            if (value !== undefined) this.entries.set(key, { value, expiresAt: loadedAt + ttl(value) });
          }
        })
        .finally(() => {
          for (const key of keysToLoad) this.inflight.delete(key);
        });
      for (const key of keysToLoad) this.inflight.set(key, load);
      pending.push(load);
    }

    await Promise.all(pending);

    const result = new Map<K, V>();
    for (const key of uniqueKeys) {
      const entry = this.entries.get(key);
      if (entry) result.set(key, entry.value);
    }
    return result;
  }
}
