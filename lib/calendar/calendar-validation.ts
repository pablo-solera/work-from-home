import { z } from "zod";
import { isValidDateKey } from "./dates";

const dateKeySchema = z.string().refine(isValidDateKey, "Fecha inválida");
const formBoolean = z.preprocess((value) => value === "true", z.boolean());
const formNumber = z.preprocess((value) => Number(value), z.number().int());

export const toggleWorkFromHomeDaySchema = z.object({
  date: dateKeySchema,
  enabled: formBoolean,
  targetUserId: z.string().uuid(),
  sourcePath: z.enum(["/calendar", "/team", "/admin", "/coverage"]),
});

export const replicateWorkFromHomeDaysSchema = z.object({
  targetUserId: z.string().uuid(),
  year: formNumber,
  month: formNumber.pipe(z.number().min(1).max(12)),
  scope: z.enum(["next", "untilYearEnd"]),
});
