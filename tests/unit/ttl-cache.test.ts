import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/lib/cache/ttl-cache";

describe("TtlCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("loads missing keys once and serves them until they expire", async () => {
    const cache = new TtlCache<string, number>();
    const loader = vi.fn(async (keys: string[]) => new Map(keys.map((key) => [key, key.length])));

    expect((await cache.getMany(["a", "bb"], loader, () => 1000)).get("bb")).toBe(2);
    await cache.getMany(["a", "bb"], loader, () => 1000);
    expect(loader).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1001);
    await cache.get("a", loader, () => 1000);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(loader).toHaveBeenLastCalledWith(["a"]);
  });

  it("shares an in-flight load but does not block callers of other keys", async () => {
    const cache = new TtlCache<string, number>();
    let release: () => void = () => undefined;
    const slow = vi.fn(() => new Promise<Map<string, number>>((resolve) => { release = () => resolve(new Map([["slow", 1]])); }));
    const fast = vi.fn(async () => new Map([["fast", 2]]));

    const first = cache.get("slow", slow, () => 1000);
    const second = cache.get("slow", slow, () => 1000);
    expect(await cache.get("fast", fast, () => 1000)).toBe(2);

    release();
    expect(await Promise.all([first, second])).toEqual([1, 1]);
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it("does not loop when the loader omits a key and lets the next call retry after a failure", async () => {
    const cache = new TtlCache<string, number>();
    const partial = vi.fn(async () => new Map<string, number>());
    expect((await cache.getMany(["x"], partial, () => 1000)).size).toBe(0);
    expect(partial).toHaveBeenCalledTimes(1);

    const failing = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(new Map([["x", 1]]));
    await expect(cache.get("x", failing, () => 1000)).rejects.toThrow("down");
    expect(await cache.get("x", failing, () => 1000)).toBe(1);
  });
});
