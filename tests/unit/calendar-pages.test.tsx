import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: { id: "user-1", name: "Usuario", email: "user@example.com", role: "admin" as "admin" | "coordinator" | "employee" },
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  requireAdmin: vi.fn(),
  requireAuthorizedUser: vi.fn(),
  getUserById: vi.fn(),
  getAdminCalendarOverview: vi.fn(),
  getAdminCalendarUsers: vi.fn(),
  getAdminUserCalendar: vi.fn(),
  getCoordinatorCalendarOverview: vi.fn(),
  getCoordinatorCalendarUsers: vi.fn(),
  getCoordinatorEmployeeCalendar: vi.fn(),
  getTeamCalendarForViewer: vi.fn(),
  getMinimumEditableDate: vi.fn(() => "2026-08-19"),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/link", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin, requireAuthorizedUser: mocks.requireAuthorizedUser }));
vi.mock("@/lib/users/user-service", () => ({ getUserById: mocks.getUserById }));
vi.mock("@/lib/calendar/calendar-service", () => ({
  getAdminCalendarOverview: mocks.getAdminCalendarOverview,
  getAdminCalendarUsers: mocks.getAdminCalendarUsers,
  getAdminUserCalendar: mocks.getAdminUserCalendar,
  getCoordinatorCalendarOverview: mocks.getCoordinatorCalendarOverview,
  getCoordinatorCalendarUsers: mocks.getCoordinatorCalendarUsers,
  getCoordinatorEmployeeCalendar: mocks.getCoordinatorEmployeeCalendar,
  getMinimumEditableDate: mocks.getMinimumEditableDate,
  getTeamCalendarForViewer: mocks.getTeamCalendarForViewer,
}));
vi.mock("@/components/admin/admin-calendar", () => ({ AdminCalendar: function MockAdminCalendar() { return null; } }));
vi.mock("@/components/calendar/employee-calendar-filter", () => ({ EmployeeCalendarFilter: function MockEmployeeCalendarFilter() { return null; } }));
vi.mock("@/components/calendar/month-calendar-variants", () => ({
  EditableMonthCalendar: function MockEditableMonthCalendar() { return null; },
  RequestableMonthCalendar: function MockRequestableMonthCalendar() { return null; },
}));
vi.mock("@/components/common/page-header", () => ({ PageHeader: function MockPageHeader({ children }: { children: unknown }) { return children; } }));

import AdminPage from "@/app/(dashboard)/admin/page";
import CoveragePage from "@/app/(dashboard)/coverage/page";
import TeamPage from "@/app/(dashboard)/team/page";

const calendar = { cells: [], monthName: "agosto de 2026", selectedDates: [], pendingDates: [], weeklyAllowance: 3, weeklyCounts: {} };
const overview = { cells: [], monthName: "agosto de 2026", users: [], employees: [], daySummariesByDate: {} };

function resetMocks() {
  vi.clearAllMocks();
  mocks.currentUser.role = "admin";
  mocks.requireAdmin.mockResolvedValue(mocks.currentUser);
  mocks.requireAuthorizedUser.mockResolvedValue(mocks.currentUser);
  mocks.getUserById.mockResolvedValue({ canEditAllWfh: false });
  mocks.getAdminCalendarOverview.mockResolvedValue(overview);
  mocks.getAdminCalendarUsers.mockResolvedValue([]);
  mocks.getAdminUserCalendar.mockResolvedValue({ ...calendar, user: { id: "employee-1", name: "Empleado", email: "employee@example.com" } });
  mocks.getCoordinatorCalendarOverview.mockResolvedValue({ ...overview, employees: [] });
  mocks.getCoordinatorCalendarUsers.mockResolvedValue([]);
  mocks.getCoordinatorEmployeeCalendar.mockResolvedValue({ ...calendar, employee: { id: "employee-1", name: "Empleado", email: "employee@example.com" } });
  mocks.getTeamCalendarForViewer.mockResolvedValue({ cells: [], monthName: "agosto de 2026", daySummariesByDate: {} });
}

function findComponent(node: unknown, name: string): { props: Record<string, unknown> } | null {
  if (!node || typeof node !== "object") return null;
  const element = node as { type?: { name?: string } | ((props: Record<string, unknown>) => unknown); props?: { children?: unknown } };
  if (element.type?.name === name) return { props: element.props as Record<string, unknown> };
  if (typeof element.type === "function") {
    const rendered = element.type(element.props as Record<string, unknown>);
    const match = findComponent(rendered, name);
    if (match) return match;
  }
  const children = element.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const match = findComponent(child, name);
      if (match) return match;
    }
  }
  return findComponent(children, name);
}

describe("dashboard calendar pages", () => {
  it("allows admin access and renders the admin overview", async () => {
    resetMocks();
    const page = await AdminPage({ searchParams: Promise.resolve({ year: "2026", month: "8" }) });
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(findComponent(page, "MockAdminCalendar")?.props).toMatchObject({ currentMonthHref: "/admin?month=8&year=2026" });
  });

  it("redirects coverage users without the broad edit permission", async () => {
    resetMocks();
    mocks.currentUser.role = "coordinator";
    await expect(CoveragePage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/calendar");
    expect(mocks.getAdminCalendarOverview).not.toHaveBeenCalled();
  });

  it("renders the employee team view with the team detail endpoint", async () => {
    resetMocks();
    mocks.currentUser.role = "employee";
    const page = await TeamPage({ searchParams: Promise.resolve({ year: "2026", month: "8" }) });
    expect(mocks.getTeamCalendarForViewer).toHaveBeenCalledWith(mocks.currentUser, 2026, 8);
    expect(findComponent(page, "MockAdminCalendar")?.props).toMatchObject({ dayDetailEndpoint: "/api/calendar/team/day" });
  });

  it("keeps the selected employee in the current-month link for coordinator detail", async () => {
    resetMocks();
    mocks.currentUser = { ...mocks.currentUser, id: "coordinator-1", role: "coordinator" };
    mocks.requireAuthorizedUser.mockResolvedValue(mocks.currentUser);
    const page = await TeamPage({ searchParams: Promise.resolve({ year: "2026", month: "8", employeeId: "employee-1" }) });
    expect(findComponent(page, "MockEditableMonthCalendar")?.props).toMatchObject({ currentMonthHref: "/team?month=8&year=2026&employeeId=employee-1", enforceWeeklyAllowance: true });
  });
});
