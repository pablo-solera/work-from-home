import type { BindParameters } from "oracledb";
import { getOracleSchema, queryOracle } from "@/db/oracle";

type HolidayRow = { FECHA: string };

export async function findHolidayDateKeys(start: string, endExclusive: string): Promise<string[]> {
  const schema = getOracleSchema();
  if (schema !== "TIMERTASK_ES") throw new Error("Los días festivos se consultan exclusivamente en TIMERTASK_ES.");
  const binds: BindParameters = { startDate: start, endDate: endExclusive };
  const rows = await queryOracle<HolidayRow>(`
    SELECT TO_CHAR(FECHAFESTIVO, 'YYYY-MM-DD') AS FECHA
      FROM ${schema}.TDIAS_FESTIVOS
     WHERE FECHAFESTIVO >= TO_DATE(:startDate, 'YYYY-MM-DD')
       AND FECHAFESTIVO < TO_DATE(:endDate, 'YYYY-MM-DD')
  `, binds);
  return rows.map((row) => row.FECHA);
}
