import { buildSyncPlan, runUserSync } from "@/lib/users/sync-service";

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const plan = await buildSyncPlan();

  console.log(`Empleados activos sin usuario (a crear): ${plan.toCreate.length}`);
  for (const employee of plan.toCreate) {
    console.log(`   + emp_id=${employee.empId}  ${employee.name} <${employee.email}>`);
  }

  const totalWfhLost = plan.toDelete.reduce((sum, entry) => sum + entry.wfhDays, 0);
  console.log(`\nUsuarios que ya no son empleados activos (a desactivar): ${plan.toDelete.length} (se conservarán ${totalWfhLost} días de teletrabajo históricos)`);
  for (const entry of plan.toDelete) {
    console.log(`   - user=${entry.userId} emp_id=${entry.empId} (${entry.wfhDays} días WFH)`);
  }

  if (!shouldApply) {
    console.log("\n[dry-run] No se ha modificado nada. Ejecuta con --apply para aplicar los cambios.");
    return;
  }

  const result = await runUserSync(plan);

  console.log(`\n[apply] Creados: ${result.created} | Desactivados: ${result.deactivated}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
