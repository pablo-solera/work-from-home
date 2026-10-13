import type { BindParameters } from "oracledb";
import { getOracleSchema, queryOracle } from "@/db/oracle";
import { getStaffLineIds } from "@/lib/employees/org-repository";

export type OracleEmployee = {
  empId: number;
  name: string;
  email: string;
  wdNumber: string | null;
};

type EmployeeRow = {
  EMP_ID: number;
  EMP_NOMBRE: string | null;
  EMP_APELLIDO1: string | null;
  EMP_APELLIDO2: string | null;
  EMP_EMAIL: string | null;
  EMP_TEL1: string | null;
};

// Only real, active employees are considered part of the staff.
const ACTIVE_EMPLOYEE_FILTER = "e.emp_esempleado = 1 AND e.emp_fec_baja IS NULL";

function buildName(row: EmployeeRow): string {
  const parts = [row.EMP_NOMBRE, row.EMP_APELLIDO1, row.EMP_APELLIDO2].filter((part) => Boolean(part && part.trim()));

  return parts.length > 0 ? parts.join(" ") : `Empleado ${row.EMP_ID}`;
}

function mapRow(row: EmployeeRow): OracleEmployee {
  return {
    empId: row.EMP_ID,
    name: buildName(row),
    email: (row.EMP_EMAIL ?? "").trim(),
    wdNumber: (row.EMP_TEL1 ?? "").trim() || null,
  };
}

const SELECT_EMPLOYEE = `
  SELECT e.emp_id AS emp_id,
         e.emp_nombre AS emp_nombre,
         e.emp_apellido1 AS emp_apellido1,
         e.emp_apellido2 AS emp_apellido2,
         e.emp_email AS emp_email,
         e.emp_tel1 AS emp_tel1
    FROM {schema}.templeados e
`;

function sql(body: string): string {
  return SELECT_EMPLOYEE.replace("{schema}", getOracleSchema()) + body;
}

/** Finds an active employee by email (case-insensitive). Used for login. */
export async function findActiveEmployeeByEmail(email: string): Promise<OracleEmployee | null> {
  const rows = await queryOracle<EmployeeRow>(`${sql(`WHERE ${ACTIVE_EMPLOYEE_FILTER} AND LOWER(e.emp_email) = :email`)}`, {
    email: email.trim().toLowerCase(),
  });

  return rows.length > 0 ? mapRow(rows[0]) : null;
}

/** Returns all active employees (the full active staff). */
export async function findAllActiveEmployees(): Promise<OracleEmployee[]> {
  const rows = await queryOracle<EmployeeRow>(sql(`WHERE ${ACTIVE_EMPLOYEE_FILTER} ORDER BY e.emp_nombre, e.emp_apellido1`));

  return rows.map(mapRow);
}

/**
 * Returns identity for the given employee ids as a Map keyed by empId.
 * Includes employees regardless of active status, so historical names still
 * resolve. Returns an empty map when no ids are provided.
 */
export async function findEmployeesByIds(empIds: number[]): Promise<Map<number, OracleEmployee>> {
  const uniqueIds = Array.from(new Set(empIds));

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const results = await Promise.all(Array.from({ length: Math.ceil(uniqueIds.length / 900) }, async (_, chunkIndex) => {
    const chunk = uniqueIds.slice(chunkIndex * 900, (chunkIndex + 1) * 900);
    const binds: BindParameters = {};
    const placeholders = chunk.map((id, index) => {
      (binds as Record<string, unknown>)[`id${index}`] = id;
      return `:id${index}`;
    });
    return queryOracle<EmployeeRow>(sql(`WHERE e.emp_id IN (${placeholders.join(", ")})`), binds);
  }));

  return new Map(results.flat().map((row) => [row.EMP_ID, mapRow(row)]));
}

/** Fetches an admin identity page by Oracle employee IDs, avoiding a full staff scan. */
export async function searchEmployees(query: string, offset: number, limit: number): Promise<{ employees: OracleEmployee[]; total: number }> {
  const normalizedQuery = query.trim().slice(0, 120).toLowerCase();
  const escapedQuery = normalizedQuery.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
  const searchTerm = `%${escapedQuery}%`;
  const lineIds = getStaffLineIds();
  if (lineIds.length === 0) return { employees: [], total: 0 };
  const lineBinds: BindParameters = {};
  const linePlaceholders = lineIds.map((lineId, index) => {
    (lineBinds as Record<string, number>)[`line${index}`] = lineId;
    return `:line${index}`;
  });
  const binds = { ...lineBinds, searchTerm, offset: Math.max(0, offset), limit: Math.max(1, Math.min(limit, 100)) };
  const schema = getOracleSchema();
  const fromAndScope = `FROM ${schema}.templeados e WHERE e.emp_esempleado = 1 AND e.emp_fec_baja IS NULL AND EXISTS (SELECT 1 FROM ${schema}.templeado_grupos eg JOIN ${schema}.tgrupos g ON g.grupo_id = eg.grupo_id WHERE eg.emp_id = e.emp_id AND eg.fecha_baja IS NULL AND g.linea_id IN (${linePlaceholders.join(", ")})) AND (LOWER(e.emp_nombre || ' ' || e.emp_apellido1 || ' ' || e.emp_apellido2) LIKE :searchTerm ESCAPE '\\' OR LOWER(e.emp_email) LIKE :searchTerm ESCAPE '\\')`;
  const [countRows, rows] = await Promise.all([
    queryOracle<{ TOTAL: number }>(`SELECT COUNT(DISTINCT e.emp_id) AS total ${fromAndScope}`, binds),
    queryOracle<EmployeeRow>(`SELECT e.emp_id AS emp_id, e.emp_nombre AS emp_nombre, e.emp_apellido1 AS emp_apellido1, e.emp_apellido2 AS emp_apellido2, e.emp_email AS emp_email, e.emp_tel1 AS emp_tel1 ${fromAndScope} ORDER BY e.emp_nombre, e.emp_apellido1 OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`, binds),
  ]);
  return { employees: rows.map(mapRow), total: Number(countRows[0]?.TOTAL ?? 0) };
}
