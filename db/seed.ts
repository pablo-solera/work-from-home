import { hashPassword } from "@/lib/auth/password";
import { createUser } from "@/lib/users/user-repository";

// System accounts have no Oracle employee; they log in via fallback_email.
async function main() {
  await createUser({
    fallbackName: "Admin",
    fallbackEmail: "admin@example.com",
    passwordHash: await hashPassword("admin123"),
    role: "admin",
  });

  const [coordinator] = await createUser({
    fallbackName: "Coordinador",
    fallbackEmail: "coordinator@example.com",
    passwordHash: await hashPassword("coordinator123"),
    role: "coordinator",
  });

  await createUser({
    fallbackName: "Employee",
    fallbackEmail: "employee@example.com",
    passwordHash: await hashPassword("employee123"),
    role: "employee",
    coordinatorId: coordinator?.id,
  });
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
