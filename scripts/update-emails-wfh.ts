import { writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import { findUsersForEmailUpdate, updateUserEmailAndWdNumber, updateUserEmailByWdNumber } from "@/lib/users/user-repository";

const DEFAULT_ORIGINAL_XLSX_PATH = "C:\\Users\\Pablo.Avila\\OneDrive - Solera Holdings, Inc\\Desktop\\Teletrabajo 2026.xlsx";
const DEFAULT_EMAILS_XLSX_PATH = "C:\\Users\\Pablo.Avila\\OneDrive - Solera Holdings, Inc\\Desktop\\Listado WFH.xlsx";
const OUTPUT_CSV_PATH = path.join(process.cwd(), "scripts", "wfh-email-mapping.csv");
const ORIGINAL_SHEET_NAME = "WFH";
const EMAILS_SHEET_NAME = "Hoja1";
const ADMIN_PLACEHOLDER_NAME = "Unico, Administrador";

type NewEmailRow = {
  email: string;
  sources: string[];
};

type OriginalPerson = {
  givenAliases: string[];
  name: string;
  surnameAliases: string[];
  wdNumber: string;
};

type DatabaseUser = Awaited<ReturnType<typeof findUsersForEmailUpdate>>[number];

type MappingRow = {
  confidence: "ambiguous" | "exact" | "high" | "missing" | "review";
  currentEmail: string;
  issue: string;
  name: string;
  matchedBy: "name" | "wd" | "";
  newEmail: string;
  sources: string;
  userId: string;
  wdNumber: string;
};

function getCellValue(worksheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number) {
  const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];

  if (!cell || cell.v === undefined || cell.v === null) {
    return "";
  }

  return String(cell.v).trim();
}

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeWords(value: string) {
  return stripAccents(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeNameKey(value: string) {
  return normalizeWords(value).join(" ");
}

function addUnique(values: string[], value: string) {
  if (value && !values.includes(value)) {
    values.push(value);
  }
}

function createAliases(words: string[]) {
  const aliases: string[] = [];

  addUnique(aliases, words[0] ?? "");
  addUnique(aliases, words.slice(0, 2).join(""));
  addUnique(aliases, words.join(""));

  return aliases;
}

function getNameParts(name: string) {
  if (name.includes(",")) {
    const [rawSurnames, rawGivenNames] = name.split(",", 2);

    return {
      givenWords: normalizeWords(rawGivenNames),
      surnameWords: normalizeWords(rawSurnames),
    };
  }

  const words = normalizeWords(name);
  const [firstWord, ...surnameWords] = words;

  return {
    givenWords: firstWord ? [firstWord] : [],
    surnameWords,
  };
}

function parseEmailName(email: string) {
  const localPart = email.split("@", 1)[0] ?? "";
  const parts = normalizeWords(localPart);
  const [givenSegment, ...surnameSegments] = parts;

  return {
    givenSegment: givenSegment ?? "",
    surnameSegment: surnameSegments.join(""),
  };
}

function loadWorksheet(filePath: string, sheetName: string) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`No existe la hoja ${sheetName} en ${filePath}`);
  }

  return worksheet;
}

function parseOriginalPeople(filePath: string) {
  const worksheet = loadWorksheet(filePath, ORIGINAL_SHEET_NAME);
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  const people: OriginalPerson[] = [];

  for (let rowIndex = 5; rowIndex <= range.e.r; rowIndex += 1) {
    const wdNumber = getCellValue(worksheet, rowIndex, 0);
    const coordinatorName = getCellValue(worksheet, rowIndex, 3);
    const name = getCellValue(worksheet, rowIndex, 4);

    if (!wdNumber || !coordinatorName || !name || name === ADMIN_PLACEHOLDER_NAME) {
      continue;
    }

    const { givenWords, surnameWords } = getNameParts(name);

    people.push({
      givenAliases: createAliases(givenWords),
      name,
      surnameAliases: createAliases(surnameWords),
      wdNumber,
    });
  }

  return people;
}

function addEmail(emailRowsByEmail: Map<string, NewEmailRow>, rawEmail: string, source: string) {
  if (!rawEmail || rawEmail === "Coordinador" || rawEmail === "Empleado") {
    return;
  }

  const email = normalizeEmail(rawEmail);
  const existing = emailRowsByEmail.get(email);

  if (existing) {
    if (!existing.sources.includes(source)) {
      existing.sources.push(source);
    }

    return;
  }

  emailRowsByEmail.set(email, { email, sources: [source] });
}

function parseNewEmails(filePath: string) {
  const worksheet = loadWorksheet(filePath, EMAILS_SHEET_NAME);
  const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, raw: false });
  const emailRowsByEmail = new Map<string, NewEmailRow>();

  for (const row of rows) {
    const [coordinatorEmail, employeeEmail] = row;

    addEmail(emailRowsByEmail, coordinatorEmail ?? "", "coordinador");
    addEmail(emailRowsByEmail, employeeEmail ?? "", "empleado");
  }

  return Array.from(emailRowsByEmail.values()).sort((left, right) => left.email.localeCompare(right.email));
}

function findMatchingPerson(email: string, people: OriginalPerson[]) {
  const { givenSegment, surnameSegment } = parseEmailName(email);
  const givenMatches = people.filter((person) => person.givenAliases.includes(givenSegment));
  const exactMatches = givenMatches.filter((person) => person.surnameAliases.includes(surnameSegment));

  if (exactMatches.length === 1) {
    return { confidence: "exact" as const, issue: "", person: exactMatches[0] };
  }

  if (exactMatches.length > 1) {
    return { confidence: "ambiguous" as const, issue: `Coinciden ${exactMatches.length} personas por nombre y apellido`, person: null };
  }

  if (givenMatches.length === 1) {
    return { confidence: "review" as const, issue: "Emparejado solo por nombre unico; revisar apellido", person: givenMatches[0] };
  }

  if (givenMatches.length > 1) {
    return { confidence: "ambiguous" as const, issue: `Coinciden ${givenMatches.length} personas por nombre, pero no por apellido`, person: null };
  }

  const surnameMatches = people.filter((person) => person.surnameAliases.includes(surnameSegment));

  if (surnameMatches.length === 1) {
    return { confidence: "review" as const, issue: "Emparejado solo por apellido unico; revisar nombre", person: surnameMatches[0] };
  }

  return { confidence: "missing" as const, issue: "No se encontro coincidencia en el Excel original", person: null };
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: MappingRow[]) {
  const lines = [["workday_number", "nombre", "email_bd", "email_nuevo", "confianza", "emparejado_por", "origen", "incidencia"].map(escapeCsv).join(",")];

  for (const row of rows) {
    lines.push([row.wdNumber, row.name, row.currentEmail, row.newEmail, row.confidence, row.matchedBy, row.sources, row.issue].map(escapeCsv).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function buildRows(newEmails: NewEmailRow[], originalPeople: OriginalPerson[], usersByWdNumber: Map<string, DatabaseUser>, usersByName: Map<string, DatabaseUser>) {
  const rows: MappingRow[] = [];
  const wdTargets = new Map<string, string[]>();

  for (const newEmail of newEmails) {
    const match = findMatchingPerson(newEmail.email, originalPeople);

    if (!match.person) {
      rows.push({
        confidence: match.confidence,
        currentEmail: "",
        issue: match.issue,
        matchedBy: "",
        name: "",
        newEmail: newEmail.email,
        sources: newEmail.sources.join("+"),
        userId: "",
        wdNumber: "",
      });
      continue;
    }

    const currentUserByWd = usersByWdNumber.get(match.person.wdNumber);
    const currentUserByName = usersByName.get(normalizeNameKey(match.person.name));
    const currentUser = currentUserByWd ?? currentUserByName;
    const currentEmail = currentUser?.email ?? "";
    const issues = [match.issue];
    const matchedBy = currentUserByWd ? "wd" : currentUserByName ? "name" : "";

    if (!currentUser) {
      issues.push("Usuario no encontrado en la BD por WD ni por nombre");
    }

    rows.push({
      confidence: currentUser ? match.confidence : "missing",
      currentEmail,
      issue: issues.filter(Boolean).join("; "),
      matchedBy,
      name: match.person.name,
      newEmail: newEmail.email,
      sources: newEmail.sources.join("+"),
      userId: currentUser?.id ?? "",
      wdNumber: match.person.wdNumber,
    });

    const targets = wdTargets.get(match.person.wdNumber) ?? [];
    targets.push(newEmail.email);
    wdTargets.set(match.person.wdNumber, targets);
  }

  for (const row of rows) {
    if (!row.wdNumber) {
      continue;
    }

    const targets = wdTargets.get(row.wdNumber) ?? [];

    if (targets.length > 1) {
      row.confidence = "ambiguous";
      row.issue = [row.issue, `WD asignado a varios correos nuevos: ${targets.join(" | ")}`].filter(Boolean).join("; ");
    }
  }

  return rows;
}

function addEmailCollisions(rows: MappingRow[], databaseUsers: DatabaseUser[]) {
  const userByEmail = new Map(databaseUsers.map((user) => [user.email.toLowerCase(), user]));

  for (const row of rows) {
    if (!row.wdNumber) {
      continue;
    }

    const existingUser = userByEmail.get(row.newEmail);

    if (existingUser?.email.toLowerCase() === row.currentEmail.toLowerCase()) {
      continue;
    }

    if (existingUser && existingUser.wdNumber !== row.wdNumber) {
      row.confidence = "ambiguous";
      row.issue = [row.issue, `El correo nuevo ya existe en otro WD (${existingUser.wdNumber ?? "sin WD"})`].filter(Boolean).join("; ");
    }
  }
}

function assertRowsCanBeApplied(rows: MappingRow[]) {
  const blockedRows = rows.filter((row) => row.confidence === "ambiguous" || row.confidence === "missing");

  if (blockedRows.length > 0) {
    throw new Error(`No se puede aplicar: hay ${blockedRows.length} filas sin mapeo seguro. Revisa ${OUTPUT_CSV_PATH}.`);
  }
}

async function applyRows(rows: MappingRow[]) {
  for (const row of rows) {
    if (row.matchedBy === "wd") {
      await updateUserEmailByWdNumber(row.wdNumber, row.newEmail);
      continue;
    }

    if (!row.userId) {
      throw new Error(`No se puede aplicar ${row.newEmail}: no hay usuario de BD para ${row.name}.`);
    }

    await updateUserEmailAndWdNumber(row.userId, {
      email: row.newEmail,
      wdNumber: row.wdNumber,
    });
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const originalXlsxPath = process.env.TELETRABAJO_XLSX || DEFAULT_ORIGINAL_XLSX_PATH;
  const emailsXlsxPath = process.env.WFH_EMAILS_XLSX || DEFAULT_EMAILS_XLSX_PATH;
  const originalPeople = parseOriginalPeople(originalXlsxPath);
  const newEmails = parseNewEmails(emailsXlsxPath);
  const databaseUsers = await findUsersForEmailUpdate();
  const usersByWdNumber = new Map(databaseUsers.filter((user) => user.wdNumber).map((user) => [user.wdNumber as string, user]));
  const usersByName = new Map(databaseUsers.map((user) => [normalizeNameKey(user.name), user]));
  const rows = buildRows(newEmails, originalPeople, usersByWdNumber, usersByName);

  addEmailCollisions(rows, databaseUsers);
  await writeFile(OUTPUT_CSV_PATH, toCsv(rows), "utf8");

  const safeRows = rows.filter((row) => row.confidence === "exact" || row.confidence === "high").length;
  const reviewRows = rows.filter((row) => row.confidence === "review").length;
  const blockedRows = rows.filter((row) => row.confidence === "ambiguous" || row.confidence === "missing").length;

  console.log(`Correos nuevos detectados: ${newEmails.length}`);
  console.log(`Filas exactas/alta confianza: ${safeRows}`);
  console.log(`Filas para revisar: ${reviewRows}`);
  console.log(`Filas bloqueadas: ${blockedRows}`);
  console.log(`CSV de revision: ${OUTPUT_CSV_PATH}`);

  if (!apply) {
    console.log("Dry-run completado. No se ha modificado la base de datos.");
    return;
  }

  assertRowsCanBeApplied(rows);
  await applyRows(rows);
  console.log(`Correos actualizados: ${rows.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
