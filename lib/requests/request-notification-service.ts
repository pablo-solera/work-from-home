import type { RequestNotificationSummary } from "./request-types";
import { acknowledgeAdminSubstitution, acknowledgeCoordinatorSubstitution, findNotificationSummary } from "./request-repository";

export async function getRequestNotificationSummary(userId: string, role: "admin" | "coordinator"): Promise<RequestNotificationSummary> {
  const [result] = await findNotificationSummary(userId, role);
  return { actionableRequestCount: Number(result?.actionableRequestCount ?? 0), informationalRequestCount: Number(result?.informationalRequestCount ?? 0), revision: result?.revision ? String(result.revision) : null };
}

export async function markSubstitutionAsRead(coordinatorId: string, requestId: string) {
  return (await acknowledgeCoordinatorSubstitution(coordinatorId, requestId)).length > 0;
}

export async function markAdminSubstitutionAsRead(requestId: string) {
  return (await acknowledgeAdminSubstitution(requestId)).length > 0;
}
