import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const users = [
  { id: "real", oracleEmpId: 1, fallbackName: null, fallbackEmail: null },
  { id: "test-admin", oracleEmpId: 3509, fallbackName: null, fallbackEmail: null },
  { id: "test-employee", oracleEmpId: 3511, fallbackName: null, fallbackEmail: null },
];
const identities = new Map([
  ["real", { name: "Ana Real", email: "ana@example.com", wdNumber: null }],
  ["test-admin", { name: "Test Admin", email: "test.manager@solera.com", wdNumber: null }],
  ["test-employee", { name: "Test Employee", email: "test.employee@solera.com", wdNumber: null }],
]);

const mocks = vi.hoisted(() => ({
  findAllUsers: vi.fn(),
  findUserById: vi.fn(),
  findUsersForCoordinator: vi.fn(),
  findAllWorkFromHomeDays: vi.fn(),
  findWorkFromHomeDaysByUserIds: vi.fn(),
}));

vi.mock("@/lib/users/user-repository", () => ({ findAllUsers: mocks.findAllUsers, findUserById: mocks.findUserById }));
vi.mock("@/lib/employees/org-service", () => ({
  findEmployeeByCoordinatorId: vi.fn(),
  findEmployeeTeamVisibility: vi.fn(),
  findExcludedEmpIds: vi.fn(async () => new Set<number>()),
  findUsersForCoordinator: mocks.findUsersForCoordinator,
}));
vi.mock("@/lib/employees/identity-service", () => ({ resolveUserIdentities: vi.fn(async () => identities) }));
vi.mock("@/lib/employees/staff-service", () => ({ filterVisibleStaff: vi.fn(async (list: unknown[]) => list) }));
vi.mock("@/lib/absences/absence-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/absences/absence-service")>()),
  getAbsenceSectionsByDate: vi.fn(async () => ({})),
}));
vi.mock("@/lib/requests/request-list-service", () => ({ getPendingRequestedDates: vi.fn() }));
vi.mock("@/lib/calendar/holiday-service", () => ({ getHolidayDates: vi.fn(async () => new Set<string>()) }));
vi.mock("@/lib/calendar/calendar-repository", () => ({
  findAllWorkFromHomeDays: mocks.findAllWorkFromHomeDays,
  findUserWorkFromHomeDays: vi.fn(),
  findWorkFromHomeDaysByUserIds: mocks.findWorkFromHomeDaysByUserIds,
}));

import {
  getAdminCalendarOverview,
  getAdminCalendarUsers,
  getCalendarDayDetail,
  getCoordinatorCalendarOverview,
} from "@/lib/calendar/calendar-read-service";

const date = "2030-08-05";

function setTestAccounts(enabled: boolean) {
  process.env.TEST_ACCOUNTS_ENABLED = String(enabled);
  process.env.TEST_ACCOUNTS_PASSWORD = "shared-password";
  process.env.TEST_ACCOUNT_ADMIN = "3509:test.manager@solera.com";
  process.env.TEST_ACCOUNT_COORDINATOR = "3510:test.coordinator@solera.com";
  process.env.TEST_ACCOUNT_EMPLOYEE = "3511:test.employee@solera.com";
}

describe("calendar read service and test accounts", () => {
  beforeEach(() => {
    mocks.findAllUsers.mockResolvedValue(users);
    mocks.findUserById.mockResolvedValue({ id: "viewer", canEditAllWfh: false });
    mocks.findUsersForCoordinator.mockResolvedValue([users[2]]);
    mocks.findAllWorkFromHomeDays.mockResolvedValue([{ date, userId: "real" }, { date, userId: "test-employee" }]);
    mocks.findWorkFromHomeDaysByUserIds.mockImplementation(async (ids: string[]) => [{ date, userId: "real" }, { date, userId: "test-employee" }].filter((entry) => ids.includes(entry.userId)));
  });

  afterEach(() => {
    delete process.env.TEST_ACCOUNTS_ENABLED;
    delete process.env.TEST_ACCOUNTS_PASSWORD;
    delete process.env.TEST_ACCOUNT_ADMIN;
    delete process.env.TEST_ACCOUNT_COORDINATOR;
    delete process.env.TEST_ACCOUNT_EMPLOYEE;
  });

  it("keeps test accounts out of the admin calendar, day modal and people selector", async () => {
    setTestAccounts(true);

    const overview = await getAdminCalendarOverview(2030, 8);
    expect(overview.users.map((user) => user.id)).toEqual(["real"]);
    expect(overview.daySummariesByDate[date]).toMatchObject({ officeCount: 0, remoteCount: 1 });

    const detail = await getCalendarDayDetail({ id: "admin", role: "admin" } as never, date);
    expect(detail?.teletrabajo.map((entry) => entry.userId)).toEqual(["real"]);
    expect(detail?.enOficina).toEqual([]);

    expect((await getAdminCalendarUsers()).map((user) => user.id)).toEqual(["real"]);
  });

  it("still shows the test employee to the test coordinator", async () => {
    setTestAccounts(true);

    const overview = await getCoordinatorCalendarOverview("test-coordinator", 2030, 8);
    expect(overview.employees.map((employee) => employee.id)).toEqual(["test-employee"]);
    expect(overview.daySummariesByDate[date]).toMatchObject({ remoteCount: 1 });
  });

  it("does not filter anything when test accounts are disabled", async () => {
    setTestAccounts(false);

    expect((await getAdminCalendarOverview(2030, 8)).users).toHaveLength(3);
    expect(await getAdminCalendarUsers()).toHaveLength(3);
  });
});
