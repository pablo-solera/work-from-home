import type { RequestDateFilter } from "@/lib/calendar/dates";
import type { RequestFilters, RequestStatusFilter } from "./request-service";

type RequestFilterParams = { date?: string; status?: string };

function getParam(params: RequestFilterParams | URLSearchParams | undefined, name: "date" | "status") {
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
