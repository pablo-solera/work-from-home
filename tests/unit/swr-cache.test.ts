import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SwrValue } from "@/lib/cache/swr-cache";

describe("SwrValue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("loads once and serves the cached value until it expires", async () => {
    const load = vi.fn(async () => "v1");
    const cache = new SwrValue(load, () => 1000);
    expect(await cache.get()).toBe("v1");
    expect(await cache.get()).toBe("v1");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves the stale value while one background refresh runs", async () => {
    let release: (value: string) => void = () => undefined;
    const load = vi.fn()
      .mockResolvedValueOnce("v1")
      .mockImplementationOnce(() => new Promise<string>((resolve) => { release = resolve; }));
    const cache = new SwrValue<string>(load, () => 1000);
    await cache.get();
    vi.advanceTimersByTime(1001);

    expect(await cache.get()).toBe("v1");
    expect(await cache.get()).toBe("v1");
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith("v1");

    release("v2");
    await vi.advanceTimersByTimeAsync(0);
    expect(await cache.get()).toBe("v2");
  });

  it("keeps the last good value when a refresh fails and retries later", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const load = vi.fn().mockResolvedValueOnce("v1").mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("v2");
    const cache = new SwrValue<string>(load, () => 1000);
    await cache.get();
    vi.advanceTimersByTime(1001);
    await cache.get();
    await vi.advanceTimersByTimeAsync(0);

    expect(await cache.get()).toBe("v1");
    expect(load).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(30_001);
    await cache.get();
    await vi.advanceTimersByTimeAsync(0);
    expect(await cache.get()).toBe("v2");
    errorSpy.mockRestore();
  });

  it("rejects when the very first load fails", async () => {
    const cache = new SwrValue<string>(async () => { throw new Error("down"); }, () => 1000);
    await expect(cache.get()).rejects.toThrow("down");
  });
});
