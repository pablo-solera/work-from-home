import { writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import { hashPassword } from "@/lib/auth/password";
import { createWorkFromHomeDay } from "@/lib/calendar/calendar-repository";
import { generateTemporaryPassword } from "@/lib/users/password-generator";
import { createUsers, findUsersByEmails, updateUserTeleworkFields } from "@/lib/users/user-repository";
import type { NewUser, UserRole } from "@/db/schema";

const DEFAULT_XLSX_PATH =
  "C:\\Users\\Pablo.Avila\\OneDrive - Solera Holdings, Inc\\Desktop\\Teletrabajo 2026.xlsx";
const SHEET_NAME = "WFH";
const PASSWORDS_CSV_PATH = path.join(process.cwd(), "scripts", "teletrabajo-2026-passwords.csv");
const ADMIN_PLACEHOLDER_NAME = "Unico, Administrador";

type DayColumn = {
  columnIndex: number;
  date: string;
};

type ImportedPerson = {
  name: string;
  email: string;
  role: UserRole;
  coordinatorName: string | null;
  hasWfh: boolean;
  wdNumber: string;
  workFromHomeDates: string[];
};

type PasswordRow = {
  email: string;
  name: string;
  password: string;
};

function getCellValue(worksheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number) {
  const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];

  if (!cell || cell.v === undefined || cell.v === null) {
    return "";
  }

  return String(cell.v).trim();
}

function excelSerialToDateKey(serial: number) {
  const date = new Date(Date.UTC(1899, 11, 30 + serial));
  return date.toISOString().slice(0, 10);
}

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeEmailSegment(value: string) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function createEmail(name: string) {
  let firstName: string;
  let surnames: string;

  if (name.includes(",")) {
    const [rawSurnames, rawFirstName] = name.split(",", 2);
    firstName = rawFirstName.trim();
    surnames = rawSurnames.trim();
  } else {
    const [rawFirstName, ...rawSurnames] = name.trim().split(/\s+/);
    firstName = rawFirstName;
    surnames = rawSurnames.join(" ");
  }

  const localPart = [normalizeEmailSegment(firstName), normalizeEmailSegment(surnames)]
    .filter(Boolean)
    .join(".");

  if (!localPart) {
    throw new Error(`No se pudo generar email para ${name}`);
  }

  return `${localPart}@solera.com`;
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function toPasswordsCsv(rows: PasswordRow[]) {
  const lines = ["name,email,password"];

  for (const row of rows) {
    lines.push([row.name, row.email, row.password].map(escapeCsv).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function loadWorkbook(filePath: string) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const worksheet = workbook.Sheets[SHEET_NAME];

  if (!worksheet) {
    throw new Error(`No existe la hoja ${SHEET_NAME}`);
  }

  return worksheet;
}

function parseDayColumns(worksheet: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  const dayColumns: DayColumn[] = [];

  for (let columnIndex = 5; columnIndex <= range.e.c; columnIndex += 1) {
    const value = Number(getCellValue(worksheet, 0, columnIndex));

    if (Number.isFinite(value)) {
      const date = excelSerialToDateKey(value);

      if (date.startsWith("2026-")) {
        dayColumns.push({ columnIndex, date });
      }
    }
  }

  if (dayColumns.length === 0) {
    throw new Error("No se encontraron columnas de días laborables de 2026");
  }

  return dayColumns;
}

function parsePeople(worksheet: XLSX.WorkSheet, dayColumns: DayColumn[]) {
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  const rawRows: Array<{
    hasWfh: boolean;
    name: string;
    coordinatorName: string;
    wdNumber: string;
    workFromHomeDates: string[];
  }> = [];

  for (let rowIndex = 5; rowIndex <= range.e.r; rowIndex += 1) {
    const employeeId = getCellValue(worksheet, rowIndex, 0);
    const wfhStatus = getCellValue(worksheet, rowIndex, 2);
    const coordinatorName = getCellValue(worksheet, rowIndex, 3);
    const name = getCellValue(worksheet, rowIndex, 4);

    if (!employeeId || !coordinatorName || !name || name === ADMIN_PLACEHOLDER_NAME) {
      continue;
    }

    const workFromHomeDates = dayColumns
      .filter((dayColumn) => getCellValue(worksheet, rowIndex, dayColumn.columnIndex) === "1")
      .map((dayColumn) => dayColumn.date);

    rawRows.push({
      coordinatorName,
      hasWfh: wfhStatus === "Yes",
      name,
      wdNumber: employeeId,
      workFromHomeDates,
    });
  }

  const coordinatorNames = new Set(rawRows.map((row) => row.coordinatorName).filter((name) => name !== ADMIN_PLACEHOLDER_NAME));

  return rawRows.map<ImportedPerson>((row) => ({
    coordinatorName: row.coordinatorName === row.name || row.coordinatorName === ADMIN_PLACEHOLDER_NAME ? null : row.coordinatorName,
    email: createEmail(row.name),
    hasWfh: row.hasWfh,
    name: row.name,
    role: coordinatorNames.has(row.name) ? "coordinator" : "employee",
    wdNumber: row.wdNumber,
    workFromHomeDates: row.workFromHomeDates,
  }));
}

function assertUniqueEmails(people: ImportedPerson[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const person of people) {
    if (seen.has(person.email)) {
      duplicates.add(person.email);
    }

    seen.add(person.email);
  }

  if (duplicates.size > 0) {
    throw new Error(`Emails duplicados: ${Array.from(duplicates).join(", ")}`);
  }
}

async function createUserBatch(people: ImportedPerson[], coordinatorIdByName = new Map<string, string>()) {
  const passwordsByEmail = new Map<string, string>();
  const values: NewUser[] = [];

  for (const person of people) {
    const password = generateTemporaryPassword();
    passwordsByEmail.set(person.email, password);
    values.push({
      coordinatorId: person.coordinatorName ? coordinatorIdByName.get(person.coordinatorName) : undefined,
      email: person.email,
      hasWfh: person.hasWfh,
      name: person.name,
      passwordHash: await hashPassword(password),
      role: person.role,
      wdNumber: person.wdNumber,
    });
  }

  const insertedUsers = await createUsers(values);
  const passwordRows = insertedUsers.map((user) => ({
    email: user.email,
    name: user.name,
    password: passwordsByEmail.get(user.email) ?? "",
  }));

  return { insertedUsers, passwordRows };
}

async function main() {
  const xlsxPath = process.argv[2] || process.env.TELETRABAJO_XLSX || DEFAULT_XLSX_PATH;
  const worksheet = loadWorkbook(xlsxPath);
  const dayColumns = parseDayColumns(worksheet);
  const people = parsePeople(worksheet, dayColumns);

  assertUniqueEmails(people);

  const coordinators = people.filter((person) => person.role === "coordinator");
  const employees = people.filter((person) => person.role === "employee");

  const coordinatorResult = await createUserBatch(coordinators);
  const allCoordinatorUsers = await findUsersByEmails(coordinators.map((person) => person.email));
  const coordinatorIdByName = new Map(allCoordinatorUsers.map((user) => [user.name, user.id]));

  const employeeResult = await createUserBatch(employees, coordinatorIdByName);
  const allUsers = await findUsersByEmails(people.map((person) => person.email));
  const userIdByEmail = new Map(allUsers.map((user) => [user.email, user.id]));

  let workFromHomeDaysCount = 0;

  for (const person of people) {
    const userId = userIdByEmail.get(person.email);

    if (!userId) {
      throw new Error(`No se encontró el usuario ${person.email} tras la inserción`);
    }

    await updateUserTeleworkFields(userId, {
      hasWfh: person.hasWfh,
      wdNumber: person.wdNumber,
    });

    for (const date of person.workFromHomeDates) {
      await createWorkFromHomeDay(userId, date);
      workFromHomeDaysCount += 1;
    }
  }

  const passwordRows = [...coordinatorResult.passwordRows, ...employeeResult.passwordRows];
  await writeFile(PASSWORDS_CSV_PATH, toPasswordsCsv(passwordRows), "utf8");

  console.log(`Importación completada desde: ${xlsxPath}`);
  console.log(`Usuarios detectados: ${people.length}`);
  console.log(`Coordinadores: ${coordinators.length}`);
  console.log(`Empleados: ${employees.length}`);
  console.log(`Usuarios creados en esta ejecución: ${passwordRows.length}`);
  console.log(`Días de teletrabajo procesados: ${workFromHomeDaysCount}`);
  console.log(`Contraseñas temporales: ${PASSWORDS_CSV_PATH}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
