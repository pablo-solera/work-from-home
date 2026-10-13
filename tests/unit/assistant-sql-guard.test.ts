import { describe, expect, it } from "vitest";
import { validateOracleQuery, validatePostgresQuery } from "@/lib/assistant/sql-guard";

describe("assistant SQL guard", () => {
  it("allows SELECTs from the WFH allowlist", () => {
    expect(validatePostgresQuery("SELECT id, oracle_emp_id FROM public.users WHERE oracle_emp_id IS NOT NULL")).toContain("SELECT");
  });

  it("allows WITH queries using allowlisted tables", () => {
    expect(validatePostgresQuery("WITH active AS (SELECT id FROM public.users) SELECT id FROM active")).toContain("WITH");
  });

  it("allows nested read-only subqueries with allowlisted sources", () => {
    expect(validatePostgresQuery("SELECT result.id FROM (SELECT id FROM public.users) result")).toContain("SELECT");
  });

  it("allows common aggregates and joins", () => {
    expect(validatePostgresQuery("SELECT COUNT(*) AS people FROM public.users u JOIN public.work_from_home_days w ON w.user_id = u.id GROUP BY w.date")).toContain("COUNT");
  });

  it("allows read-only CTE queries against qualified TimerTask tables", () => {
    expect(validateOracleQuery("WITH active AS (SELECT emp_id FROM TIMERTASK_ES.TEMPLEADOS) SELECT COUNT(*) FROM active")).toContain("WITH");
  });

  it.each([
    "DELETE FROM public.users",
    "SELECT id FROM public.users; SELECT id FROM public.users",
    "SELECT pg_sleep(10)",
    "SELECT id FROM other_schema.users",
    "SELECT id FROM users",
    "SELECT secret FROM public.secret_table",
    "SELECT id FROM public.users@otherdb",
    "SELECT 1 FROM public.users) allowed, pg_catalog.pg_roles leaked, (SELECT 1 FROM public.users",
    "SELECT role FROM (pg_catalog.pg_roles CROSS JOIN public.users) source",
    "SELECT 1 FROM (public.users JOIN pg_catalog.pg_roles ON true)",
    "SELECT 1 FROM public.users))",
    "SELECT 1 FROM public.users WHERE id = (SELECT id FROM public.users",
    "SELECT role FROM public.users UNION SELECT rolname FROM pg_roles",
    "SELECT public.dangerous_function() FROM public.users",
    "SELECT pg_catalog.pg_read_file('/etc/passwd') FROM public.users",
  ])("rejects unsafe Postgres query %s", (query) => {
    expect(() => validatePostgresQuery(query)).toThrow();
  });

  it("allows only explicitly qualified TIMERTASK_ES tables", () => {
    expect(validateOracleQuery("SELECT emp_id FROM TIMERTASK_ES.TEMPLEADOS WHERE emp_id = 1")).toContain("TIMERTASK_ES");
    expect(() => validateOracleQuery("SELECT username FROM SYS.ALL_USERS")).toThrow();
    expect(() => validateOracleQuery("SELECT emp_id FROM TEMPLEADOS")).toThrow();
    expect(() => validateOracleQuery("SELECT SYS.UTL_HTTP.REQUEST('http://example.com') FROM TIMERTASK_ES.TEMPLEADOS")).toThrow();
    expect(() => validateOracleQuery("SELECT 1 FROM TIMERTASK_ES.TEMPLEADOS) a, SYS.ALL_USERS b, (SELECT 1 FROM TIMERTASK_ES.TEMPLEADOS")).toThrow();
    expect(() => validateOracleQuery("SELECT 1 FROM (TIMERTASK_ES.TEMPLEADOS JOIN SYS.ALL_USERS ON 1 = 1)")).toThrow();
  });
});
