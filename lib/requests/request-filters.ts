import type { RequestDateFilter } from "@/lib/calendar/dates";
import type { RequestFilters, RequestStatusFilter } from "./request-types";

type RequestFilterParams = { date?: string; status?: string; view?: string };

function getParam(params: RequestFilterParams | URLSearchParams | undefined, name: "date" | "status" | "view") {
  if (!params) return undefined;
  return params instanceof URLSearchParams ? params.get(name) ?? undefined : params[name];
}

export function parseRequestFilters(params?: RequestFilterParams | URLSearchParams, defaultStatus: RequestStatusFilter = "all"): RequestFilters {
  const date = getParam(params, "date");
  const status = getParam(params, "status");

  return {
    date: (date === "month" || date === "week" ? date : "all") as RequestDateFilter,
    status: (status === "pending" || status === "accepted" || status === "rejected" || status === "cancelled" || status === "all" ? status : defaultStatus) as RequestStatusFilter,
  };
}

export function parseRequestView<T extends string>(params: RequestFilterParams | URLSearchParams | undefined, allowed: readonly T[], fallback: T): T {
  const view = getParam(params, "view");

  return view && allowed.includes(view as T) ? view as T : fallback;
}

export function createRequestViewHref(pathname: string, filters: RequestFilters, view: string, defaultView: string, defaultStatus: RequestStatusFilter = "all") {
  const params = new URLSearchParams();

  if (filters.date !== "all") params.set("date", filters.date);
  if (filters.status !== defaultStatus) params.set("status", filters.status);
  if (view !== defaultView) params.set("view", view);

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
