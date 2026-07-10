"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { runUserSync } from "@/lib/users/sync-service";
import type { UserManagementState } from "@/lib/users/user-management-state";
import type { SyncUsersState } from "@/lib/users/sync-state";
import { changeUserPassword, deleteUserById, updateUserById } from "@/lib/users/user-service";
import { changePasswordSchema, deleteUserSchema, isUserRole, updateUserSchema } from "@/lib/users/user-validation";

export async function updateUserAction(_state: UserManagementState, formData: FormData): Promise<UserManagementState> {
  const admin = await requireAdmin();

  const parsed = updateUserSchema.safeParse({
    canEditAllWfh: formData.get("canEditAllWfh"),
    coordinatorId: formData.get("coordinatorId"),
    hasWfh: formData.get("hasWfh"),
    id: formData.get("id"),
    role: formData.get("role"),
    wfhDaysAllowance: formData.get("wfhDaysAllowance"),
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

export async function syncUsersAction(): Promise<SyncUsersState> {
  await requireAdmin();

  try {
    const result = await runUserSync();

    revalidatePath("/admin/users");

    return {
      ok: true,
      created: result.created,
      deleted: result.deleted,
      passwords: result.passwords,
    };
  } catch (error) {
    console.error("Failed to sync users from Oracle:", error);

    return { error: "No se pudo sincronizar con TimerTask. Inténtalo de nuevo." };
  }
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
