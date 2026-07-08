import type { BindParameters } from "oracledb";
import { queryOracle } from "@/db/oracle";

export type OracleEmployee = {
  empId: number;
  name: string;
  email: string;
};

type EmployeeRow = {
  EMP_ID: number;
  EMP_NOMBRE: string | null;
  EMP_APELLIDO1: string | null;
  EMP_APELLIDO2: string | null;
  EMP_EMAIL: string | null;
};

// Allow-list of schemas. The schema name cannot be a bind variable, so it is
// validated to avoid SQL injection through configuration.
const ALLOWED_SCHEMAS = new Set([
  "TIMERTASK_ES",
  "TIMERTASK_BR",
  "TIMERTASK_CN",
  "TIMERTASK_DE",
  "TIMERTASK_FR",
  "TIMERTASK_MX",
  "TIMERTASK_US",
  "TIMERTASK_UKAD",
  "TIMERTASK_HPI",
  "TIMERTASK_ESSE",
  "TIMERTASK_MXUS",
]);

function getSchema(): string {
  const schema = (process.env.ORACLE_TIMERTASK_SCHEMA ?? "TIMERTASK_ES").toUpperCase();

  if (!ALLOWED_SCHEMAS.has(schema)) {
    throw new Error(`Unsupported ORACLE_TIMERTASK_SCHEMA: ${schema}`);
  }

  return schema;
}

// Only real, active employees are considered part of the staff.
const ACTIVE_EMPLOYEE_FILTER = "e.emp_esempleado = 1 AND e.emp_fec_baja IS NULL";

// Lines (TLINEAS.linea_id) whose active employees are shown/counted in the app.
// Defaults to INT (100), VIN_MAN (1600), Global DDCs (1606), Data Accuracy (1611).
// Configurable via ORACLE_STAFF_LINE_IDS (comma-separated list of line ids).
const DEFAULT_STAFF_LINE_IDS = [100, 1600, 1606, 1611];

function getStaffLineIds(): number[] {
  const raw = process.env.ORACLE_STAFF_LINE_IDS;

  if (!raw || raw.trim() === "") {
    return DEFAULT_STAFF_LINE_IDS;
  }

  const ids = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));

  return ids.length > 0 ? ids : DEFAULT_STAFF_LINE_IDS;
}

function buildName(row: EmployeeRow): string {
  const parts = [row.EMP_NOMBRE, row.EMP_APELLIDO1, row.EMP_APELLIDO2].filter((part) => Boolean(part && part.trim()));

  return parts.length > 0 ? parts.join(" ") : `Empleado ${row.EMP_ID}`;
}

function mapRow(row: EmployeeRow): OracleEmployee {
  return {
    empId: row.EMP_ID,
    name: buildName(row),
    email: (row.EMP_EMAIL ?? "").trim(),
  };
}

const SELECT_EMPLOYEE = `
  SELECT e.emp_id AS emp_id,
         e.emp_nombre AS emp_nombre,
         e.emp_apellido1 AS emp_apellido1,
         e.emp_apellido2 AS emp_apellido2,
         e.emp_email AS emp_email
    FROM {schema}.templeados e
`;

function sql(body: string): string {
  return SELECT_EMPLOYEE.replace("{schema}", getSchema()) + body;
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

/**
 * Returns the set of active employee ids that belong (via a current group,
 * TEMPLEADO_GRUPOS.fecha_baja IS NULL) to one of the configured staff lines.
 * This is the "visible staff": the employees shown and counted in the app.
 */
export async function findStaffEmpIds(): Promise<Set<number>> {
  const lineIds = getStaffLineIds();

  const binds: BindParameters = {};
  const placeholders = lineIds.map((id, index) => {
    (binds as Record<string, unknown>)[`line${index}`] = id;
    return `:line${index}`;
  });

  const schema = getSchema();
  const rows = await queryOracle<{ EMP_ID: number }>(
    `
    SELECT DISTINCT e.emp_id AS emp_id
      FROM ${schema}.templeados e
      JOIN ${schema}.templeado_grupos eg ON eg.emp_id = e.emp_id AND eg.fecha_baja IS NULL
      JOIN ${schema}.tgrupos g ON g.grupo_id = eg.grupo_id
     WHERE ${ACTIVE_EMPLOYEE_FILTER} AND g.linea_id IN (${placeholders.join(", ")})
    `,
    binds
  );

  return new Set(rows.map((row) => row.EMP_ID));
}
