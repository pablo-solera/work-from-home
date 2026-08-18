import { z } from "zod";

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

export const updateUserSchema = z.object({
  canEditAllWfh: checkboxBoolean,
  hasWfh: checkboxBoolean,
  id: z.string().uuid(),
  wfhDaysAllowance: optionalNonNegativeInt,
});
