import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findHolidayDateKeys: vi.fn() }));
vi.mock("@/lib/calendar/holiday-repository", () => ({ findHolidayDateKeys: mocks.findHolidayDateKeys }));

describe("TimerTask holiday service", () => {
  it("loads holiday keys from TimerTask and caches by year", async () => {
    mocks.findHolidayDateKeys.mockResolvedValue(["2041-04-02"]);
    const { getHolidayDates } = await import("@/lib/calendar/holiday-service");

    expect(await getHolidayDates("2041-04-01", "2041-04-03")).toEqual(new Set(["2041-04-02"]));
    expect(await getHolidayDates("2041-04-02", "2041-04-02")).toEqual(new Set(["2041-04-02"]));
    expect(mocks.findHolidayDateKeys).toHaveBeenCalledTimes(1);
    expect(mocks.findHolidayDateKeys).toHaveBeenCalledWith("2041-01-01", "2042-01-01");
  });

  it("uses the existing static holiday list when TimerTask is unavailable", async () => {
    mocks.findHolidayDateKeys.mockRejectedValue(new Error("Oracle unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getHolidayDates } = await import("@/lib/calendar/holiday-service");

    expect(await getHolidayDates("2043-01-01", "2043-01-01")).toEqual(new Set(["2043-01-01"]));
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});
