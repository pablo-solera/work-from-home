const RETRY_AFTER_FAILURE_MS = 30_000;

/**
 * Single-value stale-while-revalidate cache. The first load is awaited; afterwards an expired
 * value keeps being served while one background refresh runs, and a failed refresh keeps the
 * last good value and retries after a short delay.
 */
export class SwrValue<T> {
  private value: T | undefined;
  private hasValue = false;
  private expiresAt = 0;
  private loading: Promise<T> | null = null;

  constructor(
    private readonly load: (previous: T | undefined) => Promise<T>,
    private readonly ttlMs: () => number,
  ) {}

  async get(): Promise<T> {
    if (this.hasValue) {
      if (Date.now() >= this.expiresAt) void this.refresh();
      return this.value as T;
    }
    return this.refresh();
  }

  private refresh(): Promise<T> {
    if (this.loading) return this.loading;

    this.loading = this.load(this.hasValue ? this.value : undefined)
      .then((value) => {
        this.value = value;
        this.hasValue = true;
        this.expiresAt = Date.now() + this.ttlMs();
        return value;
      })
      .catch((error: unknown) => {
        if (!this.hasValue) throw error;
        console.error("Cache refresh failed; serving the last known value:", error);
        this.expiresAt = Date.now() + RETRY_AFTER_FAILURE_MS;
        return this.value as T;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }
}
