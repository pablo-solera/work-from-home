import { resolveUserIdentities } from "@/lib/employees/identity-service";
import type { RequestCursor, RequestFilters, RequestPage } from "./request-types";
import { findAdminRequestsPage, findAdminSubstitutionNotificationsPage, findCoordinatorRequestsPage, findPendingRequestsWithDates, findRequesterRequestsPage } from "./request-repository";

export const REQUEST_PAGE_SIZE = 10;

function decodeCursor(value: string | undefined): RequestCursor | undefined {
  if (!value) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<RequestCursor>;
    if (typeof decoded.createdAt !== "string" || typeof decoded.id !== "string" || !decoded.id) return undefined;
    const createdAt = new Date(decoded.createdAt);
    return Number.isNaN(createdAt.getTime()) ? undefined : { createdAt: createdAt.toISOString(), id: decoded.id };
  } catch {
    return undefined;
  }
}

function encodeCursor(request: { createdAt: Date; id: string }) {
  return Buffer.from(JSON.stringify({ createdAt: request.createdAt.toISOString(), id: request.id })).toString("base64url");
}

function toRequestPage<T extends { id: string; createdAt: Date }>(requests: T[]): RequestPage<T> {
  const hasNextPage = requests.length > REQUEST_PAGE_SIZE;
  const page = hasNextPage ? requests.slice(0, REQUEST_PAGE_SIZE) : requests;
  const lastRequest = page.at(-1);
  return { requests: page, nextCursor: hasNextPage && lastRequest ? encodeCursor(lastRequest) : null };
}

export async function getRequestsForRequester(userId: string, filters: RequestFilters, cursorValue?: string) {
  return toRequestPage(await findRequesterRequestsPage(userId, filters, decodeCursor(cursorValue), REQUEST_PAGE_SIZE + 1));
}

export async function getPendingRequestedDates(userId: string, start: string, end: string) {
  const requests = await findPendingRequestsWithDates(userId);
  return requests.flatMap((request) => request.dates.filter((date) => !date.cancelledAt).flatMap((date) => [date.requestedDate, ...(date.replacedDate ? [date.replacedDate] : [])].filter((value) => value >= start && value <= end)));
}

export async function getRequestsForCoordinator(coordinatorId: string, filters: RequestFilters, cursorValue?: string): Promise<RequestPage<Awaited<ReturnType<typeof findCoordinatorRequestsPage>>[number] & { requesterName: string; requesterEmail: string }>> {
  const page = toRequestPage(await findCoordinatorRequestsPage(coordinatorId, filters, decodeCursor(cursorValue), REQUEST_PAGE_SIZE + 1));
  const identities = await resolveUserIdentities(page.requests.map((request) => request.requester));
  return { ...page, requests: page.requests.map((request) => ({ ...request, requesterName: identities.get(request.requester.id)?.name ?? request.requester.fallbackName ?? "Usuario", requesterEmail: identities.get(request.requester.id)?.email ?? request.requester.fallbackEmail ?? "" })) };
}

export async function getRequestsForAdmin(filters: RequestFilters, cursorValue?: string) {
  const page = toRequestPage(await findAdminRequestsPage(filters, decodeCursor(cursorValue), REQUEST_PAGE_SIZE + 1));
  const identities = await resolveUserIdentities(page.requests.map((request) => request.requester));
  return { ...page, requests: page.requests.map((request) => ({ ...request, requesterName: identities.get(request.requesterId)?.name ?? "Usuario", requesterEmail: identities.get(request.requesterId)?.email ?? "" })) };
}

export async function getAdminSubstitutionNotifications(cursorValue?: string) {
  const page = toRequestPage(await findAdminSubstitutionNotificationsPage(decodeCursor(cursorValue), REQUEST_PAGE_SIZE + 1));
  const identities = await resolveUserIdentities(page.requests.map((request) => request.requester));
  return { ...page, requests: page.requests.map((request) => ({ ...request, requesterName: identities.get(request.requesterId)?.name ?? "Usuario", requesterEmail: identities.get(request.requesterId)?.email ?? "" })) };
}
