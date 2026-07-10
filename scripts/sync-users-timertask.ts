import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPasswordsCsv } from "@/lib/users/passwords-csv";
import { buildSyncPlan, runUserSync } from "@/lib/users/sync-service";

const PASSWORDS_CSV_PATH = path.join(process.cwd(), "scripts", "sync-users-passwords.csv");

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const plan = await buildSyncPlan();

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

  const result = await runUserSync();

  if (result.passwords.length > 0) {
    await writeFile(PASSWORDS_CSV_PATH, buildPasswordsCsv(result.passwords), "utf8");
  }

  console.log(`\n[apply] Creados: ${result.created} | Borrados: ${result.deleted}`);
  if (result.passwords.length > 0) {
    console.log(`Contraseñas temporales: ${PASSWORDS_CSV_PATH}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
