import { hashPassword } from "@/lib/auth/password";
import { createUsers } from "@/lib/users/user-repository";

async function main() {
  await createUsers([
    {
      name: "Admin",
      email: "admin@example.com",
      passwordHash: await hashPassword("admin123"),
      role: "admin",
    },
  ]);

  const [coordinator] = await createUsers([
    {
      name: "Coordinador",
      email: "coordinator@example.com",
      passwordHash: await hashPassword("coordinator123"),
      role: "coordinator",
    },
  ]);

  await createUsers([
    {
      name: "Employee",
      email: "employee@example.com",
      passwordHash: await hashPassword("employee123"),
      role: "employee",
      coordinatorId: coordinator?.id,
    },
  ]);
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
