import { afterEach, describe, expect, it, vi } from "vitest";

const queryOracle = vi.hoisted(() => vi.fn());
vi.mock("@/db/oracle", () => ({ getOracleSchema: () => "TIMERTASK", queryOracle }));

import { findAbsencesByDateRange } from "@/lib/absences/absence-repository";
import { findActiveEmployeeByEmail, findAllActiveEmployees, findEmployeesByIds } from "@/lib/employees/employee-repository";
import { findOrganizationRows } from "@/lib/employees/org-repository";

type OracleCall = [string, Record<string, unknown>?];

function placeholders(sql: string): Set<string> {
  const withoutStringsAndComments = sql
    .replace(/'(?:''|[^'])*'/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
  return new Set([...withoutStringsAndComments.matchAll(/(?<!:):([A-Za-z][A-Za-z0-9_$#]*)/g)].map((match) => match[1]));
}

function expectBindContract([sql, binds = {}]: OracleCall) {
  expect([...Object.keys(binds)].sort()).toEqual([...placeholders(sql)].sort());
}

afterEach(() => {
  queryOracle.mockReset();
});

describe("Oracle SQL bind contracts", () => {
  it("binds exactly the placeholders for employee and organization queries, including chunked IDs", async () => {
    queryOracle.mockResolvedValue([]);
    await findActiveEmployeeByEmail("user@example.com");
    await findAllActiveEmployees();
    await findEmployeesByIds(Array.from({ length: 901 }, (_, index) => index + 1));
    await findOrganizationRows(1024, 1017);

    expect(queryOracle).toHaveBeenCalledTimes(6);
    for (const call of queryOracle.mock.calls as OracleCall[]) expectBindContract(call);
  });

  it("binds exactly the placeholders for absence queries with and without employee filters", async () => {
    queryOracle.mockResolvedValue([]);
    await findAbsencesByDateRange("2026-01-01", "2026-01-31");
    await findAbsencesByDateRange("2026-01-01", "2026-01-31", [10, 20, 20, 30]);

    expect(queryOracle).toHaveBeenCalledTimes(2);
    for (const call of queryOracle.mock.calls as OracleCall[]) expectBindContract(call);
  });
});
