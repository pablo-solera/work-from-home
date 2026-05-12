"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { createUsersFromEmails, type BulkUserCreationResult } from "@/lib/users/user-service";
import { bulkUsersSchema, isUserRole } from "@/lib/users/user-validation";

export type BulkUserFormState = BulkUserCreationResult & {
  error?: string;
};

export const initialBulkUserFormState: BulkUserFormState = {
  created: [],
  skipped: [],
  invalid: [],
};

export async function createUsersBulkAction(_state: BulkUserFormState, formData: FormData): Promise<BulkUserFormState> {
  await requireAdmin();

  const parsed = bulkUsersSchema.safeParse({
    coordinatorEmail: formData.get("coordinatorEmail") || undefined,
    emails: formData.get("emails"),
    role: formData.get("role"),
  });

  if (!parsed.success || !isUserRole(parsed.data.role)) {
    return { ...initialBulkUserFormState, error: "Revisa los datos del formulario." };
  }

  return createUsersFromEmails(parsed.data.emails, parsed.data.role, parsed.data.coordinatorEmail);
}
