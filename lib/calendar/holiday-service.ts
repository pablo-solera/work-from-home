import { TtlCache } from "@/lib/cache/ttl-cache";
import { getHolidayName } from "./holidays";
import { findHolidayDateKeys } from "./holiday-repository";
import { addDateKey } from "./date-utils";

const DATABASE_TTL_MS = 60 * 60 * 1000;
const FALLBACK_TTL_MS = 30 * 1000;

type HolidayYear = { dates: Set<string>; source: "database" | "fallback" };

declare global {
  var __wfhHolidayCache: TtlCache<number, HolidayYear> | undefined;
}

const holidayCache = globalThis.__wfhHolidayCache ?? new TtlCache<number, HolidayYear>();
globalThis.__wfhHolidayCache = holidayCache;

function getFallbackYear(year: number) {
  const dates = new Set<string>();
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  for (let date = start; date < end; date = addDateKey(date, 1)) {
    if (getHolidayName(date)) dates.add(date);
  }
  return dates;
}

async function loadHolidayYears(years: number[]) {
  const results: Array<[number, HolidayYear]> = await Promise.all(years.map(async (year): Promise<[number, HolidayYear]> => {
    try {
      const dates = await findHolidayDateKeys(`${year}-01-01`, `${year + 1}-01-01`);
      return [year, { dates: new Set(dates), source: "database" }];
    } catch (error) {
      console.error(`Failed to load ${year} holidays from TimerTask; using fallback calendar:`, error);
      return [year, { dates: getFallbackYear(year), source: "fallback" }];
    }
  }));
  return new Map(results);
}

function getYearTtl(value: HolidayYear) {
  return value.source === "database" ? DATABASE_TTL_MS : FALLBACK_TTL_MS;
}

export async function getHolidayDates(start: string, end: string): Promise<Set<string>> {
  if (end < start) return new Set();
  const firstYear = Number(start.slice(0, 4));
  const lastYear = Number(end.slice(0, 4));
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const cached = await holidayCache.getMany(years, loadHolidayYears, getYearTtl);
  const dates = new Set<string>();
  for (let date = start; date <= end; date = addDateKey(date, 1)) {
    if (cached.get(Number(date.slice(0, 4)))?.dates.has(date)) dates.add(date);
  }
  return dates;
}
