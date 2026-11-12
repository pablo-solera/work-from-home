import { describe, expect, it } from "vitest";
import { formatAssistantDate } from "@/lib/assistant/assistant-format";

describe("assistant date formatting", () => {
  it("formats September 18 2026 as Friday", () => {
    expect(formatAssistantDate("2026-09-18")).toBe("viernes, 18 de septiembre de 2026");
  });
});
