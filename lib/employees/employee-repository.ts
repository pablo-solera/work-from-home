import type { BindParameters } from "oracledb";
import { getOracleSchema, queryOracle } from "@/db/oracle";

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

  const binds: BindParameters = {};
  const placeholders = uniqueIds.map((id, index) => {
    (binds as Record<string, unknown>)[`id${index}`] = id;
    return `:id${index}`;
  });

  const rows = await queryOracle<EmployeeRow>(sql(`WHERE e.emp_id IN (${placeholders.join(", ")})`), binds);

  return new Map(rows.map((row) => [row.EMP_ID, mapRow(row)]));
}
