import { writeFile } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "@/lib/auth/password";
import { findAllActiveEmployees } from "@/lib/employees/employee-repository";
import { generateTemporaryPassword } from "@/lib/users/password-generator";
import { createUser, deleteUsers, findUsersWithOracleEmpId } from "@/lib/users/user-repository";
import { getDb } from "@/db";
import { workFromHomeDays } from "@/db/schema";
import { inArray } from "drizzle-orm";

const PASSWORDS_CSV_PATH = path.join(process.cwd(), "scripts", "sync-users-passwords.csv");

// Oracle employees that are not real people and must never become app users.
const IGNORED_EMP_IDS = new Set<number>([
  3425, // "Administrador Unico" - system account in Oracle
]);

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

type Plan = {
  toCreate: { empId: number; name: string; email: string }[];
  toDelete: { userId: string; empId: number; wfhDays: number }[];
};

async function buildPlan(): Promise<Plan> {
  const [employees, mappedUsers] = await Promise.all([findAllActiveEmployees(), findUsersWithOracleEmpId()]);

  const activeEmpIds = new Set(employees.map((employee) => employee.empId));
  const mappedEmpIds = new Set(mappedUsers.map((user) => user.oracleEmpId as number));

  const toCreate = employees.filter((employee) => !IGNORED_EMP_IDS.has(employee.empId) && !mappedEmpIds.has(employee.empId)).map((employee) => ({ empId: employee.empId, name: employee.name, email: employee.email }));

  const usersToDelete = mappedUsers.filter((user) => !activeEmpIds.has(user.oracleEmpId as number));

  // Count WFH days that would be lost per user to be deleted.
  const deleteIds = usersToDelete.map((user) => user.id);
  const wfhCounts = new Map<string, number>();

  if (deleteIds.length > 0) {
    const rows = await getDb().select({ userId: workFromHomeDays.userId }).from(workFromHomeDays).where(inArray(workFromHomeDays.userId, deleteIds));
    for (const row of rows) {
      wfhCounts.set(row.userId, (wfhCounts.get(row.userId) ?? 0) + 1);
    }
  }

  const toDelete = usersToDelete.map((user) => ({ userId: user.id, empId: user.oracleEmpId as number, wfhDays: wfhCounts.get(user.id) ?? 0 }));

  return { toCreate, toDelete };
}

async function apply(plan: Plan) {
  // Create new employees with a temporary password.
  const passwordRows: Array<{ email: string; name: string; password: string }> = [];

  for (const employee of plan.toCreate) {
    const password = generateTemporaryPassword();
    await createUser({
      oracleEmpId: employee.empId,
      passwordHash: await hashPassword(password),
      role: "employee",
      hasWfh: false,
    });
    passwordRows.push({ email: employee.email, name: employee.name, password });
  }

  if (passwordRows.length > 0) {
    const lines = ["name,email,password", ...passwordRows.map((row) => [row.name, row.email, row.password].map(escapeCsv).join(","))];
    await writeFile(PASSWORDS_CSV_PATH, `${lines.join("\n")}\n`, "utf8");
  }

  // Delete users that are no longer active employees (their WFH days cascade).
  if (plan.toDelete.length > 0) {
    await deleteUsers(plan.toDelete.map((entry) => entry.userId));
  }

  return { created: plan.toCreate.length, deleted: plan.toDelete.length, passwordsCsv: passwordRows.length > 0 ? PASSWORDS_CSV_PATH : null };
}

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const plan = await buildPlan();

  console.log(`Empleados activos sin usuario (a crear): ${plan.toCreate.length}`);
  for (const employee of plan.toCreate) {
    console.log(`   + emp_id=${employee.empId}  ${employee.name} <${employee.email}>`);
  }

  const totalWfhLost = plan.toDelete.reduce((sum, entry) => sum + entry.wfhDays, 0);
  console.log(`\nUsuarios que ya no son empleados activos (a borrar): ${plan.toDelete.length} (se perderían ${totalWfhLost} días de teletrabajo)`);
  for (const entry of plan.toDelete) {
    console.log(`   - user=${entry.userId} emp_id=${entry.empId} (${entry.wfhDays} días WFH)`);
  }

  if (!shouldApply) {
    console.log("\n[dry-run] No se ha modificado nada. Ejecuta con --apply para aplicar los cambios.");
    return;
  }

  const result = await apply(plan);
  console.log(`\n[apply] Creados: ${result.created} | Borrados: ${result.deleted}`);
  if (result.passwordsCsv) {
    console.log(`Contraseñas temporales: ${result.passwordsCsv}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
