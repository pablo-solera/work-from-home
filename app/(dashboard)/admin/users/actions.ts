"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { initialBulkUserFormState, type BulkUserFormState } from "@/lib/users/bulk-user-form-state";
import type { UserManagementState } from "@/lib/users/user-management-state";
import { changeUserPassword, createSingleUser, createUsersFromEmails, deleteUserById, updateUserById } from "@/lib/users/user-service";
import { bulkUsersSchema, changePasswordSchema, createUserSchema, deleteUserSchema, isUserRole, updateUserSchema } from "@/lib/users/user-validation";

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

export async function createUserAction(_state: UserManagementState, formData: FormData): Promise<UserManagementState> {
  await requireAdmin();

  const parsed = createUserSchema.safeParse({
    coordinatorId: formData.get("coordinatorId"),
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    passwordMode: formData.get("passwordMode"),
    role: formData.get("role"),
  });

  if (!parsed.success || !isUserRole(parsed.data.role)) {
    return { error: "Revisa los datos del formulario." };
  }

  const result = await createSingleUser(parsed.data);

  if (result.ok) {
    revalidatePath("/admin/users");
  }

  return result;
}

export async function updateUserAction(_state: UserManagementState, formData: FormData): Promise<UserManagementState> {
  const admin = await requireAdmin();

  const parsed = updateUserSchema.safeParse({
    canEditAllWfh: formData.get("canEditAllWfh"),
    coordinatorId: formData.get("coordinatorId"),
    email: formData.get("email"),
    hasWfh: formData.get("hasWfh"),
    id: formData.get("id"),
    name: formData.get("name"),
    role: formData.get("role"),
    wfhDaysAllowance: formData.get("wfhDaysAllowance"),
    wdNumber: formData.get("wdNumber"),
  });

  if (!parsed.success || !isUserRole(parsed.data.role)) {
    return { error: "Revisa los datos del formulario." };
  }

  const result = await updateUserById(admin, parsed.data);

  if (result.ok) {
    revalidatePath("/admin/users");
  }

  return result;
}

export async function changeUserPasswordAction(_state: UserManagementState, formData: FormData): Promise<UserManagementState> {
  await requireAdmin();

  const parsed = changePasswordSchema.safeParse({
    id: formData.get("id"),
    password: formData.get("password"),
    passwordMode: formData.get("passwordMode"),
  });

  if (!parsed.success) {
    return { error: "Revisa los datos del formulario." };
  }

  const result = await changeUserPassword(parsed.data);

  if (result.ok) {
    revalidatePath("/admin/users");
  }

  return result;
}

export async function deleteUserAction(_state: UserManagementState, formData: FormData): Promise<UserManagementState> {
  const admin = await requireAdmin();

  const parsed = deleteUserSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { error: "Revisa los datos del formulario." };
  }

  const result = await deleteUserById(admin, parsed.data.id);

  if (result.ok) {
    revalidatePath("/admin/users");
  }

  return result;
}
