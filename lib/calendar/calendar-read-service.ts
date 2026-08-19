import type { SessionUser } from "@/lib/auth/session";
import { createEmptySections, getAbsenceSectionsByDate } from "@/lib/absences/absence-service";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { filterVisibleStaff } from "@/lib/employees/staff-service";
import { findEmployeeByCoordinatorId, findEmployeeTeamVisibility, findExcludedEmpIds, findUsersForCoordinator } from "@/lib/employees/org-service";
import { findAllUsers, findUserById } from "@/lib/users/user-repository";
import { getPendingRequestedDates } from "@/lib/requests/request-service";
import { findAllWorkFromHomeDays, findUserWorkFromHomeDays, findWorkFromHomeDaysByUserIds } from "./calendar-repository";
import { buildDaySummaries, buildSectionsByDate } from "./calendar-transform";
import { getCalendarDays, getCurrentCalendarMonth, getMadridTodayDateKey, getMonthRange, getNextMonth, getWeekRange, isValidDateKey } from "./dates";

const UNKNOWN_IDENTITY = { name: "Usuario", email: null } as const;

export function getEmployeeTeamVisibleRange() {
  const current = getCurrentCalendarMonth();
  const next = getNextMonth(current.year, current.month);
  return { minimumDate: getMadridTodayDateKey(), maximumDate: getMonthRange(next.year, next.month).end };
}

async function buildUserCalendar(userId: string, year: number, month: number, knownUser?: Awaited<ReturnType<typeof findUserById>>) {
  const range = getMonthRange(year, month);
  const dataRange = { start: getWeekRange(range.start).start, end: getWeekRange(range.end).end };
  const [entries, pendingDates, user] = await Promise.all([
    findUserWorkFromHomeDays(userId, dataRange.start, dataRange.end),
    getPendingRequestedDates(userId, range.start, range.end),
    knownUser ? Promise.resolve(knownUser) : findUserById(userId),
  ]);
  const selectedDates = new Set(entries.filter((entry) => entry.date >= range.start && entry.date <= range.end).map((entry) => entry.date));
  const weeklyCounts: Record<string, number> = {};
  for (const entry of entries) {
    const weekStart = getWeekRange(entry.date).start;
    weeklyCounts[weekStart] = (weeklyCounts[weekStart] ?? 0) + 1;
  }

  return {
    ...getCalendarDays(year, month),
    selectedDates: Array.from(selectedDates),
    pendingDates,
    weeklyAllowance: user?.wfhDaysAllowance ?? 0,
    weeklyCounts,
  };
}

export function getUserCalendar(userId: string, year: number, month: number) {
  return buildUserCalendar(userId, year, month);
}

export async function getAdminCalendarOverview(year: number, month: number) {
  const range = getMonthRange(year, month);
  const [entries, allUsers] = await Promise.all([findAllWorkFromHomeDays(range.start, range.end), findAllUsers()]);
  const calendar = getCalendarDays(year, month);
  const [absenceSectionsByDate, users, identities, excludedEmpIds] = await Promise.all([
    getAbsenceSectionsByDate(range.start, range.end, allUsers),
    filterVisibleStaff(allUsers),
    resolveUserIdentities(allUsers),
    findExcludedEmpIds(),
  ]);
  const sectionsByDate = buildSectionsByDate(entries, users, identities, absenceSectionsByDate, calendar, excludedEmpIds);
  const userList = users.map((user) => {
    const identity = identities.get(user.id) ?? UNKNOWN_IDENTITY;
    return { id: user.id, name: identity.name, email: identity.email ?? "" };
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));

  return { ...calendar, users: userList, daySummariesByDate: buildDaySummaries(sectionsByDate, calendar) };
}

async function getCalendarUsersForViewer(viewer: SessionUser) {
  if (viewer.role === "admin") return filterVisibleStaff(await findAllUsers());
  const currentUser = await findUserById(viewer.id);
  if (currentUser?.canEditAllWfh) return filterVisibleStaff(await findAllUsers());
  if (viewer.role === "coordinator") return filterVisibleStaff(await findUsersForCoordinator(viewer.id));
  const visibility = await findEmployeeTeamVisibility(viewer.id);
  if (!visibility?.teamWfhVisible) return null;
  return filterVisibleStaff(await findUsersForCoordinator(visibility.coordinatorId));
}

export async function getEmployeeTeamWfhDayDetail(viewer: SessionUser, date: string) {
  if (!isValidDateKey(date) || viewer.role !== "employee") return null;
  const { minimumDate, maximumDate } = getEmployeeTeamVisibleRange();
  if (date < minimumDate || date > maximumDate) return null;
  const visibility = await findEmployeeTeamVisibility(viewer.id);
  if (!visibility?.teamWfhVisible) return null;
  const users = await filterVisibleStaff(await findUsersForCoordinator(visibility.coordinatorId));
  const [entries, identities, absenceSectionsByDate, excludedEmpIds] = await Promise.all([
    findWorkFromHomeDaysByUserIds(users.map((user) => user.id), date, date),
    resolveUserIdentities(users),
    getAbsenceSectionsByDate(date, date, users),
    findExcludedEmpIds(),
  ]);
  const calendar = getCalendarDays(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
  const dayCalendar = { ...calendar, cells: calendar.cells.filter((cell) => cell?.date === date) };
  const sections = buildSectionsByDate(entries, users, identities, absenceSectionsByDate, dayCalendar, excludedEmpIds)[date] ?? createEmptySections();
  return { ...sections, bajas: [] };
}

export async function getCalendarDayDetail(viewer: SessionUser, date: string) {
  if (!isValidDateKey(date) || viewer.role === "employee") return null;
  const users = await getCalendarUsersForViewer(viewer);
  if (!users) return null;
  const calendar = getCalendarDays(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
  const [entries, absenceSectionsByDate, identities, excludedEmpIds] = await Promise.all([
    findWorkFromHomeDaysByUserIds(users.map((user) => user.id), date, date),
    getAbsenceSectionsByDate(date, date, users),
    resolveUserIdentities(users),
    findExcludedEmpIds(),
  ]);
  const dayCalendar = { ...calendar, cells: calendar.cells.filter((cell) => cell?.date === date) };
  const sectionsByDate = buildSectionsByDate(entries, users, identities, absenceSectionsByDate, dayCalendar, excludedEmpIds);
  return sectionsByDate[date] ?? createEmptySections();
}

export async function getAdminCalendarUsers() {
  const allUsers = await findAllUsers();
  const [users, identities] = await Promise.all([filterVisibleStaff(allUsers), resolveUserIdentities(allUsers)]);
  return users.map((user) => {
    const identity = identities.get(user.id) ?? UNKNOWN_IDENTITY;
    return { id: user.id, name: identity.name, email: identity.email ?? "" };
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getAdminUserCalendar(userId: string, year: number, month: number) {
  const user = await findUserById(userId);
  if (!user) return null;
  const [calendar, identities] = await Promise.all([buildUserCalendar(user.id, year, month, user), resolveUserIdentities([user])]);
  const identity = identities.get(user.id) ?? UNKNOWN_IDENTITY;
  return { ...calendar, user: { id: user.id, name: identity.name, email: identity.email ?? "" } };
}

export async function getCoordinatorCalendarOverview(coordinatorId: string, year: number, month: number, employeeId?: string) {
  const allEmployees = await findUsersForCoordinator(coordinatorId);
  const employees = await filterVisibleStaff(allEmployees);
  const visibleEmployees = employeeId ? employees.filter((employee) => employee.id === employeeId) : employees;
  const range = getMonthRange(year, month);
  const calendar = getCalendarDays(year, month);
  const [entries, identities, absenceSectionsByDate, excludedEmpIds] = await Promise.all([
    findWorkFromHomeDaysByUserIds(visibleEmployees.map((employee) => employee.id), range.start, range.end),
    resolveUserIdentities(employees),
    getAbsenceSectionsByDate(range.start, range.end, employees),
    findExcludedEmpIds(),
  ]);
  const sectionsByDate = buildSectionsByDate(entries, visibleEmployees, identities, absenceSectionsByDate, calendar, excludedEmpIds);
  const employeeList = employees.map((employee) => {
    const identity = identities.get(employee.id) ?? UNKNOWN_IDENTITY;
    return { id: employee.id, name: identity.name, email: identity.email ?? "" };
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { ...calendar, employees: employeeList, daySummariesByDate: buildDaySummaries(sectionsByDate, calendar) };
}

export async function getCoordinatorCalendarUsers(coordinatorId: string) {
  const employees = await filterVisibleStaff(await findUsersForCoordinator(coordinatorId));
  const identities = await resolveUserIdentities(employees);
  return employees.map((employee) => {
    const identity = identities.get(employee.id) ?? UNKNOWN_IDENTITY;
    return { id: employee.id, name: identity.name, email: identity.email ?? "" };
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getTeamCalendarForViewer(viewer: SessionUser, year: number, month: number) {
  if (viewer.role === "coordinator") return getCoordinatorCalendarOverview(viewer.id, year, month);
  if (viewer.role !== "employee") return null;
  const teamVisibility = await findEmployeeTeamVisibility(viewer.id);
  if (!teamVisibility?.teamWfhVisible) return null;
  const employees = await filterVisibleStaff(await findUsersForCoordinator(teamVisibility.coordinatorId));
  const range = getMonthRange(year, month);
  const calendar = getCalendarDays(year, month);
  const { minimumDate, maximumDate } = getEmployeeTeamVisibleRange();
  const start = range.start > minimumDate ? range.start : minimumDate;
  const end = range.end < maximumDate ? range.end : maximumDate;
  const [entries, identities, absenceSectionsByDate, excludedEmpIds] = await Promise.all([
    start <= end ? findWorkFromHomeDaysByUserIds(employees.map((employee) => employee.id), start, end) : Promise.resolve([]),
    resolveUserIdentities(employees),
    start <= end ? getAbsenceSectionsByDate(start, end, employees) : Promise.resolve({}),
    findExcludedEmpIds(),
  ]);
  const sectionsByDate = buildSectionsByDate(entries, employees, identities, absenceSectionsByDate, calendar, excludedEmpIds, minimumDate, maximumDate);
  return { ...calendar, daySummariesByDate: buildDaySummaries(sectionsByDate, calendar, minimumDate, maximumDate) };
}

export async function getCoordinatorEmployeeCalendar(coordinatorId: string, employeeId: string, year: number, month: number) {
  const employee = await findEmployeeByCoordinatorId(employeeId, coordinatorId);
  if (!employee) return null;
  const [calendar, identities] = await Promise.all([buildUserCalendar(employee.id, year, month, employee), resolveUserIdentities([employee])]);
  const identity = identities.get(employee.id) ?? UNKNOWN_IDENTITY;
  return { ...calendar, employee: { id: employee.id, name: identity.name, email: identity.email ?? "" } };
}
