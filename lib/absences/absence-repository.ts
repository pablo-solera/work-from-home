import type { BindParameters } from "oracledb";
import { queryOracle } from "@/db/oracle";
import { ABSENCE_TDIA_IDS, getAbsenceSectionKey, type AbsenceSectionKey } from "./absence-sections";

export type OracleAbsence = {
  empId: number;
  date: string;
  sectionKey: AbsenceSectionKey;
  employeeName: string | null;
};

type AbsenceRow = {
  EMP_ID: number;
  EHR_FECHA: Date;
  TDIA_ID: number;
  EMP_NOMBRE: string | null;
  EMP_APELLIDO1: string | null;
  EMP_APELLIDO2: string | null;
};

// Allow-list of schemas. The schema name cannot be passed as a bind variable,
// so we validate it to avoid SQL injection through configuration.
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

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Reads employee absences (vacations, sick leave, travel, etc.) from the Oracle
 * TIMERTASK schema for a date range. Only the day types mapped to a visible
 * absence section are returned. `start` and `end` are `YYYY-MM-DD` keys.
 */
export async function findAbsencesByDateRange(start: string, end: string): Promise<OracleAbsence[]> {
  const schema = getSchema();
  const tdiaBinds = ABSENCE_TDIA_IDS.map((_, index) => `:tdia${index}`).join(", ");

  const binds: BindParameters = {
    startDate: start,
    endDate: end,
  };

  ABSENCE_TDIA_IDS.forEach((tdiaId, index) => {
    (binds as Record<string, unknown>)[`tdia${index}`] = tdiaId;
  });

  const sql = `
    SELECT d.emp_id       AS emp_id,
           d.ehr_fecha    AS ehr_fecha,
           d.tdia_id      AS tdia_id,
           e.emp_nombre   AS emp_nombre,
           e.emp_apellido1 AS emp_apellido1,
           e.emp_apellido2 AS emp_apellido2
      FROM ${schema}.templeado_dias d
      JOIN ${schema}.templeados e ON e.emp_id = d.emp_id
     WHERE d.tdia_id IN (${tdiaBinds})
       AND d.ehr_fecha >= TO_DATE(:startDate, 'YYYY-MM-DD')
       AND d.ehr_fecha <= TO_DATE(:endDate, 'YYYY-MM-DD')
  `;

  const rows = await queryOracle<AbsenceRow>(sql, binds);

  return rows.flatMap((row) => {
    const sectionKey = getAbsenceSectionKey(row.TDIA_ID);

    if (!sectionKey) {
      return [];
    }

    const nameParts = [row.EMP_NOMBRE, row.EMP_APELLIDO1, row.EMP_APELLIDO2].filter((part) => Boolean(part && part.trim()));

    return [
      {
        empId: row.EMP_ID,
        date: toDateKey(row.EHR_FECHA),
        sectionKey,
        employeeName: nameParts.length > 0 ? nameParts.join(" ") : null,
      },
    ];
  });
}
