import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findAbsencesByDateRange = vi.hoisted(() => vi.fn());
vi.mock("@/lib/absences/absence-repository", () => ({ findAbsencesByDateRange }));
vi.mock("@/lib/users/user-repository", () => ({ findAllUsers: vi.fn(async () => []) }));

const users = [
  { id: "ana", oracleEmpId: 1, fallbackName: null, fallbackEmail: null },
  { id: "beto", oracleEmpId: 2, fallbackName: null, fallbackEmail: null },
];

function absence(empId: number, date: string, sectionKey = "vacaciones") {
  return { date, employeeName: `Empleado ${empId}`, empId, sectionKey };
}

async function load() {
  return import("@/lib/absences/absence-service");
}

describe("absence month cache", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as { __wfhAbsenceMonthCache?: unknown }).__wfhAbsenceMonthCache;
    findAbsencesByDateRange.mockReset().mockResolvedValue([
      absence(1, "2030-08-05"),
      absence(2, "2030-08-05", "viajes"),
      absence(1, "2030-08-20"),
    ]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-08-01T10:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("reads a whole month for the whole staff once and serves day ranges from memory", async () => {
    const { getAbsenceSectionsByDate } = await load();

    const day = await getAbsenceSectionsByDate("2030-08-05", "2030-08-05", users);
    const week = await getAbsenceSectionsByDate("2030-08-01", "2030-08-31", users);

    expect(findAbsencesByDateRange).toHaveBeenCalledTimes(1);
    expect(findAbsencesByDateRange).toHaveBeenCalledWith("2030-08-01", "2030-08-31");
    expect(day["2030-08-05"].vacaciones.map((entry) => entry.userId)).toEqual(["ana"]);
    expect(day["2030-08-05"].viajes.map((entry) => entry.userId)).toEqual(["beto"]);
    expect(Object.keys(week)).toEqual(["2030-08-05", "2030-08-20"]);
  });

  it("only returns absences of the requested users and dates", async () => {
    const { getAbsenceSectionsByDate } = await load();

    const result = await getAbsenceSectionsByDate("2030-08-06", "2030-08-31", [users[1]]);

    expect(result).toEqual({});
    const onlyAna = await getAbsenceSectionsByDate("2030-08-01", "2030-08-10", [users[0]]);
    expect(Object.keys(onlyAna)).toEqual(["2030-08-05"]);
    expect(onlyAna["2030-08-05"].viajes).toEqual([]);
  });

  it("loads each month of a range once", async () => {
    const { getAbsenceSectionsByDate } = await load();

    await getAbsenceSectionsByDate("2030-08-20", "2030-10-05", users);

    expect(findAbsencesByDateRange.mock.calls.map((call) => call[0])).toEqual(["2030-08-01", "2030-09-01", "2030-10-01"]);
  });

  it("refreshes after 30 seconds", async () => {
    const { getAbsenceSectionsByDate } = await load();
    await getAbsenceSectionsByDate("2030-08-05", "2030-08-05", users);
    vi.advanceTimersByTime(29_000);
    await getAbsenceSectionsByDate("2030-08-05", "2030-08-05", users);
    expect(findAbsencesByDateRange).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);
    await getAbsenceSectionsByDate("2030-08-05", "2030-08-05", users);
    expect(findAbsencesByDateRange).toHaveBeenCalledTimes(2);
  });

  it("degrades to empty sections without caching an Oracle failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    findAbsencesByDateRange.mockRejectedValueOnce(new Error("Oracle down"));
    const { getAbsenceSectionsByDate } = await load();

    expect(await getAbsenceSectionsByDate("2030-08-05", "2030-08-05", users)).toEqual({});
    const retry = await getAbsenceSectionsByDate("2030-08-05", "2030-08-05", users);

    expect(Object.keys(retry)).toEqual(["2030-08-05"]);
    expect(findAbsencesByDateRange).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});
