import { z } from "zod";
import { isValidDateKey } from "@/lib/calendar/dates";

const optionalComment = z.preprocess((value) => {
  const comment = String(value ?? "").trim();
  return comment || null;
}, z.string().nullable());
const dateList = z.preprocess((value) => String(value ?? "").split(/[\n,;]+/).map((date) => date.trim()).filter(Boolean), z.array(z.string().refine(isValidDateKey, "Fecha inválida")));

export const createWfhRequestSchema = z.object({
  kind: z.enum(["additional", "substitution", "removal"]),
  requestedDates: dateList,
  replacedDates: dateList,
  comment: optionalComment,
});

export const decideWfhRequestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["accepted", "rejected"]),
  comment: optionalComment,
});

export const requestIdSchema = z.object({ id: z.string().uuid() });
export const cancelWfhRequestDateSchema = z.object({ requestId: z.string().uuid(), dateId: z.string().uuid() });

export function formDataObject(formData: FormData, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, formData.get(field)]));
}
