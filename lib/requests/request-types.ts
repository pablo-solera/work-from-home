import type { RequestDateFilter } from "@/lib/calendar/dates";

export type RequestStatusFilter = "all" | "pending" | "accepted" | "rejected" | "cancelled";
export type RequestFilters = { date: RequestDateFilter; status: RequestStatusFilter };
export type RequestCursor = { createdAt: string; id: string };
export type RequestPage<T> = { requests: T[]; nextCursor: string | null };
export type RequestFormState = { error?: string; message?: string; ok?: boolean; requestId?: string };
export type RequestKind = "additional" | "substitution" | "removal";
export type RequestNotificationSummary = { actionableRequestCount: number; informationalRequestCount: number; revision: string | null };
