import { z } from "zod";
import type { UserRole } from "@/db/schema";

const optionalUuid = z.preprocess((value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value), z.string().uuid().optional());

const optionalPassword = z.preprocess((value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value), z.string().min(8).optional());

export const loginSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

export const bulkUsersSchema = z.object({
  emails: z.string().min(1),
  role: z.enum(["admin", "coordinator", "employee"]).default("employee"),
  coordinatorEmail: z.string().optional(),
});

export const createUserSchema = z.object({
  coordinatorId: optionalUuid,
  email: z.string().email().transform((email) => email.toLowerCase()),
  name: z.string().trim().min(1),
  password: optionalPassword,
  passwordMode: z.enum(["generate", "manual"]).default("generate"),
  role: z.enum(["admin", "coordinator", "employee"]).default("employee"),
});

export const updateUserSchema = z.object({
  coordinatorId: optionalUuid,
  email: z.string().email().transform((email) => email.toLowerCase()),
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  role: z.enum(["admin", "coordinator", "employee"]),
});

export const changePasswordSchema = z.object({
  id: z.string().uuid(),
  password: optionalPassword,
  passwordMode: z.enum(["generate", "manual"]).default("generate"),
});

export const deleteUserSchema = z.object({
  id: z.string().uuid(),
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
  return role === "admin" || role === "coordinator" || role === "employee";
}
