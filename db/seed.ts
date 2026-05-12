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
    {
      name: "User",
      email: "user@example.com",
      passwordHash: await hashPassword("user123"),
      role: "user",
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
