import { hashPassword } from "@/lib/auth/password";
import { findEmployeesByIds } from "@/lib/employees/employee-repository";
import { getTestAccounts } from "@/lib/employees/test-accounts";
import { generateTemporaryPassword } from "@/lib/users/password-generator";
import { upsertTestUser } from "@/lib/users/user-repository";

async function main() {
  const accounts = getTestAccounts();
  if (!accounts) throw new Error("Set TEST_ACCOUNTS_ENABLED=true before seeding test users.");

  let identities = new Map<number, { name: string }>();
  try {
    identities = await findEmployeesByIds(accounts.map((account) => account.empId));
  } catch (error) {
    console.warn("Oracle identities unavailable; using test account names.", error);
  }

  for (const account of accounts) {
    const identity = identities.get(account.empId);
    await upsertTestUser({
      oracleEmpId: account.empId,
      fallbackEmail: account.email,
      fallbackName: identity?.name ?? (
        account.role === "admin"
          ? "Test Manager"
          : account.role === "coordinator"
            ? "Test Coordinator"
            : "Test Employee"
      ),
      passwordHash: await hashPassword(generateTemporaryPassword()),
      hasWfh: true,
    });
  }
}

main()
  .then(() => {
    console.log("Seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
