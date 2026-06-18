import { z } from "zod";
import type { UserRole } from "@/db/schema";

const optionalUuid = z.preprocess((value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value), z.string().uuid().optional());

const optionalPassword = z.preprocess((value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value), z.string().min(8).optional());

const optionalText = z.preprocess((value) => (value === null || (typeof value === "string" && value.trim() === "") ? null : value), z.string().trim().max(50).nullable());

const checkboxBoolean = z.preprocess((value) => value === "on", z.boolean());

const optionalNonNegativeInt = z.preprocess((value) => {
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : value;
}, z.number().int().min(0).max(999).nullable());

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
  canEditAllWfh: checkboxBoolean,
  coordinatorId: optionalUuid,
  email: z.string().email().transform((email) => email.toLowerCase()),
  hasWfh: checkboxBoolean,
  name: z.string().trim().min(1),
  password: optionalPassword,
  passwordMode: z.enum(["generate", "manual"]).default("generate"),
  role: z.enum(["admin", "coordinator", "employee"]).default("employee"),
  wfhDaysAllowance: optionalNonNegativeInt,
  wdNumber: optionalText,
});

export const updateUserSchema = z.object({
  canEditAllWfh: checkboxBoolean,
  coordinatorId: optionalUuid,
  email: z.string().email().transform((email) => email.toLowerCase()),
  hasWfh: checkboxBoolean,
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  role: z.enum(["admin", "coordinator", "employee"]),
  wfhDaysAllowance: optionalNonNegativeInt,
  wdNumber: optionalText,
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
