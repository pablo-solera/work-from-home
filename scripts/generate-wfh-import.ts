import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { findEmployeesByIds } from "@/lib/employees/employee-repository";
import { findUsersWithOracleEmpId } from "@/lib/users/user-repository";
import { generateSql, type ImportRow } from "./wfh-import-sql";

const DEFAULT_INPUT = "C:\\Users\\Pablo.Avila\\Downloads\\Teletrabajo 2026_11112026.xlsx";
const DEFAULT_OUTPUT = path.resolve("import-wfh.sql");
const YEAR = 2026;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function cellText(value: unknown) {
  if (value && typeof value === "object" && "text" in value) return String(value.text).trim();
  if (value && typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  return String(value ?? "").trim();
}

function dateHeader(value: unknown): string | null {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = cellText(value);
  if (DATE_PATTERN.test(text)) return text;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function marked(value: unknown) {
  const text = cellText(value).toLowerCase();
  return text === "1" || text === "x" || text === "si" || text === "sí" || text === "yes" || text === "true";
}

function parseArgs() {
  const args = process.argv.slice(2);
  const input = args.find((arg) => !arg.startsWith("--")) ?? DEFAULT_INPUT;
  const output = args.find((arg) => arg.startsWith("--output="))?.slice("--output=".length) ?? DEFAULT_OUTPUT;
  return { input: path.resolve(input), output: path.resolve(output) };
}

async function readWorkbook(input: string): Promise<{ rows: ImportRow[]; headers: string[]; sheet: string }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(input);
  const candidates: Array<{ sheet: ExcelJS.Worksheet; headerRow: number; idColumn: number; dateColumns: Array<{ column: number; date: string }> }> = [];

  workbook.eachSheet((sheet) => {
    let headerRow = 0;
    let idColumn = 0;
    for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 20); rowNumber += 1) {
      let rowIdColumn = 0;
      let hasEmployeeColumn = false;
      sheet.getRow(rowNumber).eachCell((cell, column) => {
        if (["emp_id", "emp id", "empid", "employee id", "wd nr", "wd", "wd number", "numero wd", "nº wd"].includes(normalizeHeader(cell.value))) {
          rowIdColumn = column;
        }
        if (normalizeHeader(cell.value) === "empleado") hasEmployeeColumn = true;
      });
      if (rowIdColumn && (hasEmployeeColumn || !idColumn)) {
        headerRow = rowNumber;
        idColumn = rowIdColumn;
      }
    }
    const dateColumns: Array<{ column: number; date: string }> = [];
    sheet.getRow(1).eachCell((cell, column) => {
      const date = dateHeader(cell.value);
      if (date?.startsWith(`${YEAR}-`)) dateColumns.push({ column, date });
    });
    if (idColumn && dateColumns.length > 0) candidates.push({ sheet, headerRow, idColumn, dateColumns });
  });

  if (candidates.length !== 1) throw new Error(`No se pudo identificar una única hoja con identificador y fechas de ${YEAR}. Hojas candidatas: ${candidates.length}.`);
  const candidate = candidates[0];
  const workbookRows: Array<{ wdNumber: string; dates: string[]; sourceRow: number }> = [];
  const idHeader = normalizeHeader(candidate.sheet.getRow(candidate.headerRow).getCell(candidate.idColumn).value);

  if (!idHeader.includes("wd")) {
    throw new Error("El generador espera que el Excel identifique las filas mediante WD Nr.");
  }

  candidate.sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= candidate.headerRow) return;
    const rawId = cellText(row.getCell(candidate.idColumn).value);
    if (!rawId) return;
    if (rawId.toUpperCase() === "1000NP") return;
    const dates = candidate.dateColumns.filter(({ column }) => marked(row.getCell(column).value)).map(({ date }) => date);
    workbookRows.push({ wdNumber: rawId, dates, sourceRow: rowNumber });
  });

  const duplicateWds = new Set<string>();
  const workbookByWd = new Map<string, { wdNumber: string; dates: string[]; sourceRow: number }>();
  for (const row of workbookRows) {
    if (workbookByWd.has(row.wdNumber)) duplicateWds.add(row.wdNumber);
    workbookByWd.set(row.wdNumber, row);
  }
  if (duplicateWds.size > 0) {
    throw new Error(`El Excel contiene WD Nr duplicados: ${[...duplicateWds].join(", ")}.`);
  }

  const localUsers = await findUsersWithOracleEmpId();
  const oracleEmployees = await findEmployeesByIds(localUsers.map((user) => user.oracleEmpId).filter((id): id is number => id !== null));
  const localByWd = new Map<string, number>();
  for (const user of localUsers) {
    if (user.oracleEmpId === null) continue;
    const employee = oracleEmployees.get(user.oracleEmpId);
    if (!employee?.wdNumber) continue;
    const existing = localByWd.get(employee.wdNumber);
    if (existing !== undefined && existing !== user.oracleEmpId) {
      throw new Error(`El WD Nr ${employee.wdNumber} corresponde a varios oracle_emp_id locales.`);
    }
    localByWd.set(employee.wdNumber, user.oracleEmpId);
  }

  const missingLocalWds = workbookRows.filter((row) => !localByWd.has(row.wdNumber));
  if (missingLocalWds.length > 0) {
    console.warn(`WD Nr del Excel sin usuario local; se omiten: ${missingLocalWds.length}. Primeros WD: ${missingLocalWds.slice(0, 10).map((row) => row.wdNumber).join(", ")}.`);
  }

  const rows: ImportRow[] = workbookRows.filter((row) => localByWd.has(row.wdNumber)).map((row) => ({ empId: localByWd.get(row.wdNumber)!, dates: row.dates, sourceRow: row.sourceRow }));
  const localWithoutWorkbook = localUsers.filter((user) => {
    const employee = user.oracleEmpId === null ? null : oracleEmployees.get(user.oracleEmpId);
    return !employee?.wdNumber || !workbookByWd.has(employee.wdNumber);
  }).length;
  console.log(`Cruce local completado; usuarios locales sin fila en Excel: ${localWithoutWorkbook}`);

  const byEmp = new Map<number, ImportRow>();
  for (const row of rows) {
    const existing = byEmp.get(row.empId);
    if (existing) {
      existing.dates = Array.from(new Set([...existing.dates, ...row.dates])).toSorted();
    } else {
      byEmp.set(row.empId, { ...row, dates: Array.from(new Set(row.dates)).toSorted() });
    }
  }

  return { rows: [...byEmp.values()].toSorted((a, b) => a.empId - b.empId), headers: candidate.dateColumns.map(({ date }) => date), sheet: candidate.sheet.name };
}

const { input, output } = parseArgs();
const parsed = await readWorkbook(input);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, generateSql(parsed.rows, parsed.sheet, input), "utf8");
console.log(`SQL generado: ${output}`);
console.log(`Hoja: ${parsed.sheet}; empleados: ${parsed.rows.length}; días: ${parsed.rows.reduce((total, row) => total + row.dates.length, 0)}`);
