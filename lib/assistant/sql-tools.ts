import { getPostgresClient } from "@/db";
import { getOracleSchema, queryOracleReadOnly } from "@/db/oracle";
import type { SessionUser } from "@/lib/auth/session";
import { getAssistantVisibleUsers } from "./assistant-scope";
import { validateOracleQuery, validatePostgresQuery } from "./sql-guard";

const MAX_ROWS = 200;
const MAX_CELL_CHARS = 2_000;

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return `[BINARY ${value.byteLength} bytes]`;
  if (typeof value === "string" && value.length > MAX_CELL_CHARS) return `${value.slice(0, MAX_CELL_CHARS)}… [truncado]`;
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
  return value;
}

function resultShape(rows: Record<string, unknown>[]) {
  const truncated = rows.length > MAX_ROWS;
  const limitedRows = rows.slice(0, MAX_ROWS).map((row) => serializeValue(row));
  return {
    columns: rows[0] ? Object.keys(rows[0]) : [],
    rowCount: limitedRows.length,
    rows: limitedRows,
    truncated,
    note: truncated ? `Se muestran las primeras ${MAX_ROWS} filas; el resultado está truncado.` : undefined,
  };
}

export async function queryWorkFromHome(actor: SessionUser, sql: string) {
  if (!await getAssistantVisibleUsers(actor)) throw new Error("No tienes permiso para consultar este ámbito.");
  const validated = validatePostgresQuery(sql);
  const client = getPostgresClient();
  const rows = await client.begin(async (transaction) => {
    await transaction`set transaction read only`;
    await transaction`set local statement_timeout = '5s'`;
    await transaction`set local search_path = pg_catalog, public`;
    const capped = `SELECT * FROM (${validated}) AS assistant_read_only_result LIMIT $1`;
    return transaction.unsafe(capped, [MAX_ROWS + 1]);
  });
  return resultShape(rows as unknown as Record<string, unknown>[]);
}

export async function queryTimerTask(actor: SessionUser, sql: string) {
  if (!await getAssistantVisibleUsers(actor)) throw new Error("No tienes permiso para consultar este ámbito.");
  const schema = getOracleSchema();
  if (schema !== "TIMERTASK_ES") throw new Error("El asistente solo puede consultar el esquema TIMERTASK_ES.");
  const validated = validateOracleQuery(sql);
  const rows = await queryOracleReadOnly<Record<string, unknown>>(`SELECT * FROM (${validated}) assistant_read_only_result WHERE ROWNUM <= ${MAX_ROWS + 1}`);
  return resultShape(rows);
}

export async function listTimerTaskTables(search = "%") {
  const schema = getOracleSchema();
  if (schema !== "TIMERTASK_ES") throw new Error("El asistente solo puede consultar el esquema TIMERTASK_ES.");
  const pattern = search.trim().replace(/[^a-zA-Z0-9_%]/g, "").toUpperCase().slice(0, 60) || "%";
  const rows = await queryOracleReadOnly<Record<string, unknown>>(
    "SELECT table_name FROM all_tables WHERE owner = :owner AND table_name LIKE :table_pattern ORDER BY table_name",
    { owner: "TIMERTASK_ES", table_pattern: pattern },
  );
  return { tables: rows.map((row) => row.TABLE_NAME).slice(0, 200) };
}

export async function describeTimerTaskTable(tableName: string) {
  const schema = getOracleSchema();
  if (schema !== "TIMERTASK_ES") throw new Error("El asistente solo puede consultar el esquema TIMERTASK_ES.");
  const name = tableName.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_$#]{0,127}$/.test(name)) throw new Error("Nombre de tabla no válido.");
  const rows = await queryOracleReadOnly<Record<string, unknown>>(
    "SELECT column_name, data_type, nullable FROM all_tab_columns WHERE owner = :owner AND table_name = :table_name ORDER BY column_id",
    { owner: "TIMERTASK_ES", table_name: name },
  );
  return { schema: "TIMERTASK_ES", table: name, columns: rows };
}
