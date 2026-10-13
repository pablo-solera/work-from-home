import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("fixed-window rate limiter", () => {
  it("allows the configured number of calls and blocks the next one", () => {
    expect(checkRateLimit("unit-rate-limit", 2, 1000, 100).allowed).toBe(true);
    expect(checkRateLimit("unit-rate-limit", 2, 1000, 200).allowed).toBe(true);
    expect(checkRateLimit("unit-rate-limit", 2, 1000, 300).allowed).toBe(false);
  });

  it("starts a new window after the previous one expires", () => {
    expect(checkRateLimit("unit-rate-limit-expiry", 1, 1000, 100).allowed).toBe(true);
    expect(checkRateLimit("unit-rate-limit-expiry", 1, 1000, 1100).allowed).toBe(true);
  });
});
