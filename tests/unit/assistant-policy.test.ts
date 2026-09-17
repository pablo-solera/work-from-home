import { afterEach, describe, expect, it, vi } from "vitest";
import { validateAssistantRange } from "@/lib/assistant/assistant-policy";

describe("assistant query policy", () => {
  afterEach(() => vi.useRealTimers());

  it("allows a range of 31 days around today", () => {
    vi.useFakeTimers({ now: new Date("2026-09-17T12:00:00Z") });
    expect(validateAssistantRange("2026-09-17", "2026-10-17")).toMatchObject({ days: 31 });
  });

  it("rejects ranges longer than 31 days", () => {
    vi.useFakeTimers({ now: new Date("2026-09-17T12:00:00Z") });
    expect(validateAssistantRange("2026-09-17", "2026-10-18")).toEqual({ error: "Una consulta no puede abarcar más de 31 días." });
  });

  it("allows historical dates without a backward limit", () => {
    vi.useFakeTimers({ now: new Date("2026-09-17T12:00:00Z") });
    expect(validateAssistantRange("2025-01-10", "2025-01-20")).toMatchObject({ days: 11 });
  });

  it("keeps the three-month future limit", () => {
    vi.useFakeTimers({ now: new Date("2026-09-17T12:00:00Z") });
    expect(validateAssistantRange("2027-01-01", "2027-01-02")).toEqual({ error: "Solo puedo consultar fechas hasta tres meses hacia adelante." });
  });
});
