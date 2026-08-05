import type { BindParameters } from "oracledb";
import { queryOracle } from "@/db/oracle";

const DEFAULT_STAFF_LINE_IDS = [100, 1600, 1606, 1608, 1611];
export const DEFAULT_EXCLUDED_GROUP_IDS = [1040, 1057, 1060, 1066];
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

export type OrganizationOracleRows = {
  hierarchy: { EMP_ID: number; COORDINATOR_EMP_ID: number | null }[];
  roles: { EMP_ID: number; GROUP_ID: number }[];
};

function getSchema() {
  const schema = (process.env.ORACLE_TIMERTASK_SCHEMA ?? "TIMERTASK_ES").toUpperCase();
  if (!ALLOWED_SCHEMAS.has(schema)) throw new Error(`Unsupported ORACLE_TIMERTASK_SCHEMA: ${schema}`);
  return schema;
}

function getLineIds() {
  const values = (process.env.ORACLE_STAFF_LINE_IDS ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));
  return values.length > 0 ? values : DEFAULT_STAFF_LINE_IDS;
}

export function getExcludedGroupIds() {
  const values = (process.env.ORACLE_EXCLUDED_GROUP_IDS ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  return values.length > 0 ? [...new Set(values)] : DEFAULT_EXCLUDED_GROUP_IDS;
}

function bindList(prefix: string, values: number[]) {
  const binds: BindParameters = {};
  const placeholders = values.map((value, index) => {
    const name = `${prefix}${index}`;
    (binds as Record<string, number>)[name] = value;
    return `:${name}`;
  });
  return { binds, placeholders };
}

const ACTIVE_EMPLOYEE_FILTER = "e.emp_esempleado = 1 AND e.emp_fec_baja IS NULL";

/** Loads the complete organization in two Oracle queries. */
export async function findOrganizationRows(adminGroupId: number, coordinatorGroupId: number): Promise<OrganizationOracleRows> {
  const schema = getSchema();
  const groupList = bindList("group", [adminGroupId, coordinatorGroupId, ...getExcludedGroupIds()]);
  const lineList = bindList("line", getLineIds());

  const [roles, hierarchy] = await Promise.all([
    queryOracle<{ EMP_ID: number; GROUP_ID: number }>(
      `SELECT DISTINCT eg.emp_id AS emp_id, eg.grupo_id AS group_id
         FROM ${schema}.templeado_grupos eg
         JOIN ${schema}.templeados e ON e.emp_id = eg.emp_id
        WHERE eg.grupo_id IN (${groupList.placeholders.join(", ")})
          AND eg.fecha_baja IS NULL
          AND ${ACTIVE_EMPLOYEE_FILTER}`,
      groupList.binds,
    ),
    queryOracle<{ EMP_ID: number; COORDINATOR_EMP_ID: number | null }>(
      `SELECT eg.emp_id AS emp_id, MIN(g.grupo_coordinador) AS coordinator_emp_id
         FROM ${schema}.templeado_grupos eg
         JOIN ${schema}.tgrupos g ON g.grupo_id = eg.grupo_id
         JOIN ${schema}.templeados e ON e.emp_id = eg.emp_id
        WHERE eg.fecha_baja IS NULL
          AND ${ACTIVE_EMPLOYEE_FILTER}
          AND g.linea_id IN (${lineList.placeholders.join(", ")})
        GROUP BY eg.emp_id`,
      lineList.binds,
    ),
  ]);

  return { hierarchy, roles };
}
