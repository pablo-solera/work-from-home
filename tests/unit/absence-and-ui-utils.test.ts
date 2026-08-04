import { describe, expect, it } from "vitest";
import { ABSENCE_TDIA_IDS, ABSENCE_SECTIONS, getAbsenceSectionKey } from "@/lib/absences/absence-sections";
import { getUserInitials } from "@/components/common/generated-avatar";
import { createCalendarHref } from "@/lib/calendar/links";

describe("absence sections", () => {
  it("maps every visible Oracle type and returns null for unknown ids", () => {
    expect(ABSENCE_SECTIONS).toHaveLength(9);
    expect(ABSENCE_TDIA_IDS).toContain(1);
    expect(getAbsenceSectionKey(1)).toBe("vacaciones");
    expect(getAbsenceSectionKey(14)).toBe("permisos");
    expect(getAbsenceSectionKey(999)).toBeNull();
  });
});

describe("small UI utilities", () => {
  it("generates initials with fallback", () => {
    expect(getUserInitials("Ana García López")).toBe("AG");
    expect(getUserInitials("  ")).toBe("?");
  });

  it("builds calendar links without an all employee id", () => {
    expect(createCalendarHref("/admin", { month: 8, year: 2026 })).toBe("/admin?month=8&year=2026");
    expect(createCalendarHref("/admin", { employeeId: "u1", month: 8, year: 2026 })).toContain("employeeId=u1");
    expect(createCalendarHref("/admin", { employeeId: "all", month: 8, year: 2026 })).not.toContain("employeeId");
  });
});
