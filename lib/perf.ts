/**
 * Opt-in query and section timing. Set PERF_LOG=1 to print one line per Oracle query,
 * Postgres query and measured section; without it every helper is a no-op.
 */
export const PERF_ENABLED = process.env.PERF_LOG === "1";

function compactSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim().slice(0, 110);
}

export function perfLog(kind: "oracle" | "pg" | "section", label: string, ms?: number, extra?: string) {
  if (!PERF_ENABLED) return;
  const duration = ms === undefined ? "" : ` ${ms.toFixed(0)}ms`;
  console.info(`[perf] ${kind.padEnd(7)}${duration}${extra ? ` ${extra}` : ""} ${label}`);
}

export function perfSql(sql: string) {
  return compactSql(sql);
}

/** Times an async section. Returns the callback result untouched. */
export async function measure<T>(label: string, run: () => Promise<T>): Promise<T> {
  if (!PERF_ENABLED) return run();
  const startedAt = performance.now();
  try {
    return await run();
  } finally {
    perfLog("section", label, performance.now() - startedAt);
  }
}
