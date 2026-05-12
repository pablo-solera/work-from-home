import { z } from "zod";
import type { UserRole } from "@/db/schema";

export const loginSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

export const bulkUsersSchema = z.object({
  emails: z.string().min(1),
  role: z.enum(["admin", "user"]).default("user"),
});

export function parseBulkEmails(input: string) {
  const rawEmails = input
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(rawEmails));
}

export function isValidEmail(email: string) {
  return z.string().email().safeParse(email).success;
}

export function isUserRole(role: string): role is UserRole {
  return role === "admin" || role === "user";
}
