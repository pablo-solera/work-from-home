import type { SessionUser } from "@/lib/auth/session";
import { createEmptySections, type DaySections, getAbsenceSectionsByDate } from "@/lib/absences/absence-service";
import { ABSENCE_SECTIONS } from "@/lib/absences/absence-sections";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { filterVisibleStaff } from "@/lib/employees/staff-service";
import { findAllUsers, findUserById } from "@/lib/users/user-repository";
import { findEmployeeByCoordinatorId, findEmployeeTeamVisibility, findExcludedEmpIds, findUsersForCoordinator } from "@/lib/employees/org-service";
import { createWorkFromHomeDay, deleteWorkFromHomeDay, findAllWorkFromHomeDays, findUserWorkFromHomeDays, findWorkFromHomeDaysByUserIds, replaceWorkFromHomeDays } from "./calendar-repository";
import { getCalendarDays, getCurrentCalendarMonth, getMadridTodayDateKey, getMonthRange, getMonthsUntilYearEnd, getNextMonth, getWeekRange, getWeekdayFromDateKey, isHoliday, isValidDateKey, isWeekendDateKey } from "./dates";
import { getPendingRequestedDates } from "@/lib/requests/request-service";

export type ReplicateWorkFromHomeScope = "next" | "untilYearEnd";

export function getMinimumEditableDate(role: SessionUser["role"]) {
  return role === "admin" ? undefined : getMadridTodayDateKey();
}

const UNKNOWN_IDENTITY = { name: "Usuario", email: null } as const;

// Sections (other than "enOficina" itself) whose people are considered NOT in
// the office on a given day: teletrabajo plus every absence section.
const OUT_OF_OFFICE_SECTION_KEYS = ABSENCE_SECTIONS.map((section) => section.key).filter((key) => key !== "enOficina");
const ABSENCE_ONLY_SECTION_KEYS = ABSENCE_SECTIONS
  .map((section) => section.key)
  .filter((key) => key !== "enOficina" && key !== "teletrabajo" && key !== "noComprende");

export type AdminCalendarDaySummary = {
  absenceCount: number;
  date: string;
  isOutOfRange?: boolean;
  officeCount: number;
  remoteCount: number;
};

export function getEmployeeTeamVisibleRange() {
  const current = getCurrentCalendarMonth();
  const next = getNextMonth(current.year, current.month);

  return {
    minimumDate: getMadridTodayDateKey(),
    maximumDate: getMonthRange(next.year, next.month).end,
  };
}

export function buildSectionsByDate(
  entries: Array<{ date: string; userId: string }>,
  users: Awaited<ReturnType<typeof findAllUsers>>,
  identities: Awaited<ReturnType<typeof resolveUserIdentities>>,
  absenceSectionsByDate: Record<string, DaySections>,
  calendar: ReturnType<typeof getCalendarDays>,
  excludedEmpIds: Set<number>,
  minimumDate?: string,
  maximumDate?: string,
) {
  const visibleUserIds = new Set(users.map((user) => user.id));
  const excludedUserIds = new Set(users
    .filter((user) => user.oracleEmpId !== null && excludedEmpIds.has(user.oracleEmpId))
    .map((user) => user.id));
  const sectionsByDate: Record<string, DaySections> = {};
  const absentUserIdsByDate: Record<string, Set<string>> = {};

  for (const [date, sections] of Object.entries(absenceSectionsByDate)) {
    if ((minimumDate && date < minimumDate) || (maximumDate && date > maximumDate)) continue;
    const filtered = createEmptySections();
    const absentIds = new Set<string>();

    for (const key of Object.keys(sections) as (keyof DaySections)[]) {
      filtered[key] = sections[key]
        .filter((entry) => entry.userId !== null && visibleUserIds.has(entry.userId) && !excludedUserIds.has(entry.userId))
        .map((entry) => {
          const identity = entry.userId ? identities.get(entry.userId) : undefined;
          return identity ? { ...entry, userName: identity.name, userEmail: identity.email } : entry;
        });

      for (const entry of filtered[key]) {
        if (entry.userId) {
          absentIds.add(entry.userId);
        }
      }
    }

    sectionsByDate[date] = filtered;
    absentUserIdsByDate[date] = absentIds;
  }

  for (const entry of entries) {
    if ((minimumDate && entry.date < minimumDate) || (maximumDate && entry.date > maximumDate)) continue;
    if (!visibleUserIds.has(entry.userId) || excludedUserIds.has(entry.userId) || absentUserIdsByDate[entry.date]?.has(entry.userId)) {
      continue;
    }

    const identity = identities.get(entry.userId) ?? UNKNOWN_IDENTITY;
    sectionsByDate[entry.date] = sectionsByDate[entry.date] ?? createEmptySections();
    sectionsByDate[entry.date].teletrabajo.push({
      userId: entry.userId,
      userName: identity.name,
      userEmail: identity.email,
    });
  }

  const officeStaff = users.filter((user) => user.oracleEmpId !== null && user.oracleEmpId !== undefined && !excludedUserIds.has(user.id));
  const toCalendarEntry = (user: { id: string }) => {
    const identity = identities.get(user.id) ?? UNKNOWN_IDENTITY;
    return { userId: user.id, userName: identity.name, userEmail: identity.email };
  };
  const excludedEntries = users.filter((user) => excludedUserIds.has(user.id)).map(toCalendarEntry);
  const officeEntries = officeStaff
    .map(toCalendarEntry)
    .sort((a, b) => a.userName.localeCompare(b.userName, "es"));

  for (const cell of calendar.cells) {
    if (!cell || cell.isWeekend || cell.isHoliday) {
      continue;
    }
    if ((minimumDate && cell.date < minimumDate) || (maximumDate && cell.date > maximumDate)) continue;

    const sections = sectionsByDate[cell.date];
    const outOfOfficeUserIds = new Set<string>();

    sectionsByDate[cell.date] = sectionsByDate[cell.date] ?? createEmptySections();
    sectionsByDate[cell.date].noComprende = excludedEntries;

    if (sections) {
      for (const key of OUT_OF_OFFICE_SECTION_KEYS) {
        for (const entry of sections[key]) {
          if (entry.userId) {
            outOfOfficeUserIds.add(entry.userId);
          }
        }
      }
    }

    const inOffice = officeEntries.filter((entry) => !outOfOfficeUserIds.has(entry.userId));

    if (inOffice.length > 0) {
      sectionsByDate[cell.date].enOficina = inOffice;
    }
  }

  return sectionsByDate;
}

export function buildDaySummaries(sectionsByDate: Record<string, DaySections>, calendar: ReturnType<typeof getCalendarDays>, minimumDate?: string, maximumDate?: string) {
  const summaries: Record<string, AdminCalendarDaySummary> = {};

  for (const cell of calendar.cells) {
    if (!cell) continue;
    const sections = sectionsByDate[cell.date] ?? createEmptySections();
    const isOutOfRange = Boolean((minimumDate && cell.date < minimumDate) || (maximumDate && cell.date > maximumDate));
    const absenceCount = ABSENCE_ONLY_SECTION_KEYS
      .reduce((total, section) => total + (isOutOfRange ? 0 : sections[section].length), 0);
    summaries[cell.date] = {
      date: cell.date,
      isOutOfRange,
      officeCount: isOutOfRange ? 0 : sections.enOficina.length,
      remoteCount: isOutOfRange ? 0 : sections.teletrabajo.length,
      absenceCount,
    };
  }

  return summaries;
}

export async function getUserCalendar(userId: string, year: number, month: number) {
  const range = getMonthRange(year, month);
  const dataRange = { start: getWeekRange(range.start).start, end: getWeekRange(range.end).end };
  const [entries, pendingDates] = await Promise.all([
    findUserWorkFromHomeDays(userId, dataRange.start, dataRange.end),
    getPendingRequestedDates(userId, range.start, range.end),
  ]);
  const user = await findUserById(userId);
  const selectedDates = new Set(entries.filter((entry) => entry.date >= range.start && entry.date <= range.end).map((entry) => entry.date));
  const weeklyCounts: Record<string, number> = {};
  for (const entry of entries) {
    const weekStart = getWeekRange(entry.date).start;
    weeklyCounts[weekStart] = (weeklyCounts[weekStart] ?? 0) + 1;
  }
  const calendar = getCalendarDays(year, month);

  return {
    ...calendar,
    selectedDates: Array.from(selectedDates),
    pendingDates,
    weeklyAllowance: user?.wfhDaysAllowance ?? 0,
    weeklyCounts,
  };
}

export async function getAdminCalendarOverview(year: number, month: number) {
  const range = getMonthRange(year, month);
  const [entries, allUsers] = await Promise.all([findAllWorkFromHomeDays(range.start, range.end), findAllUsers()]);
  const calendar = getCalendarDays(year, month);

  // Only show/count employees that belong to the configured staff lines.
  // Absences reuse `allUsers` (no extra query); identities and the staff filter
  // both hit Oracle and are independent, so run them together.
  const [absenceSectionsByDate, users, identities, excludedEmpIds] = await Promise.all([
    getAbsenceSectionsByDate(range.start, range.end, allUsers),
    filterVisibleStaff(allUsers),
    resolveUserIdentities(allUsers),
    findExcludedEmpIds(),
  ]);
  const sectionsByDate = buildSectionsByDate(entries, users, identities, absenceSectionsByDate, calendar, excludedEmpIds);

  const userList = users
    .map((user) => {
      const identity = identities.get(user.id) ?? UNKNOWN_IDENTITY;
      return { id: user.id, name: identity.name, email: identity.email ?? "" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    ...calendar,
    users: userList,
    daySummariesByDate: buildDaySummaries(sectionsByDate, calendar),
  };
}

async function getCalendarUsersForViewer(viewer: SessionUser) {
  const currentUser = await findUserById(viewer.id);
  if (viewer.role === "admin" || currentUser?.canEditAllWfh) {
    const allUsers = await findAllUsers();
    return filterVisibleStaff(allUsers);
  }

  if (viewer.role === "coordinator") {
    return filterVisibleStaff(await findUsersForCoordinator(viewer.id));
  }

  const visibility = await findEmployeeTeamVisibility(viewer.id);
  if (!visibility?.teamWfhVisible) return null;
  return filterVisibleStaff(await findUsersForCoordinator(visibility.coordinatorId));
}

export async function getEmployeeTeamWfhDayDetail(viewer: SessionUser, date: string) {
  if (!isValidDateKey(date)) return null;
  if (viewer.role !== "employee") return null;
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
  const [users, identities] = await Promise.all([
    filterVisibleStaff(allUsers),
    resolveUserIdentities(allUsers),
  ]);

  return users
    .map((user) => {
      const identity = identities.get(user.id) ?? UNKNOWN_IDENTITY;
      return { id: user.id, name: identity.name, email: identity.email ?? "" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getAdminUserCalendar(userId: string, year: number, month: number) {
  const user = await findUserById(userId);

  if (!user) {
    return null;
  }

  const [calendar, identities] = await Promise.all([getUserCalendar(user.id, year, month), resolveUserIdentities([user])]);
  const identity = identities.get(user.id) ?? UNKNOWN_IDENTITY;

  return {
    ...calendar,
    user: { id: user.id, name: identity.name, email: identity.email ?? "" },
  };
}

export async function getCoordinatorCalendarOverview(coordinatorId: string, year: number, month: number, employeeId?: string) {
  const allEmployees = await findUsersForCoordinator(coordinatorId);
  const employees = await filterVisibleStaff(allEmployees);
  const visibleEmployees = employeeId ? employees.filter((employee) => employee.id === employeeId) : employees;
  const visibleUserIds = visibleEmployees.map((employee) => employee.id);
  const range = getMonthRange(year, month);
  const calendar = getCalendarDays(year, month);

  const [entries, identities, absenceSectionsByDate, excludedEmpIds] = await Promise.all([
    findWorkFromHomeDaysByUserIds(visibleUserIds, range.start, range.end),
    resolveUserIdentities(employees),
    getAbsenceSectionsByDate(range.start, range.end, employees),
    findExcludedEmpIds(),
  ]);
  const sectionsByDate = buildSectionsByDate(entries, visibleEmployees, identities, absenceSectionsByDate, calendar, excludedEmpIds);

  const employeeList = employees
    .map((employee) => {
      const identity = identities.get(employee.id) ?? UNKNOWN_IDENTITY;
      return { id: employee.id, name: identity.name, email: identity.email ?? "" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    ...calendar,
    employees: employeeList,
    daySummariesByDate: buildDaySummaries(sectionsByDate, calendar),
  };
}

export async function getCoordinatorCalendarUsers(coordinatorId: string) {
  const allEmployees = await findUsersForCoordinator(coordinatorId);
  const employees = await filterVisibleStaff(allEmployees);
  const identities = await resolveUserIdentities(employees);

  return employees
    .map((employee) => {
      const identity = identities.get(employee.id) ?? UNKNOWN_IDENTITY;
      return { id: employee.id, name: identity.name, email: identity.email ?? "" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getTeamCalendarForViewer(viewer: SessionUser, year: number, month: number) {
  if (viewer.role === "coordinator") {
    return getCoordinatorCalendarOverview(viewer.id, year, month);
  }

  if (viewer.role !== "employee") {
    return null;
  }

  const teamVisibility = await findEmployeeTeamVisibility(viewer.id);

  if (!teamVisibility?.teamWfhVisible) {
    return null;
  }

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

  return {
    ...calendar,
    daySummariesByDate: buildDaySummaries(sectionsByDate, calendar, minimumDate, maximumDate),
  };
}

export async function getCoordinatorEmployeeCalendar(coordinatorId: string, employeeId: string, year: number, month: number) {
  const employee = await findEmployeeByCoordinatorId(employeeId, coordinatorId);

  if (!employee) {
    return null;
  }

  const [calendar, identities] = await Promise.all([getUserCalendar(employee.id, year, month), resolveUserIdentities([employee])]);
  const identity = identities.get(employee.id) ?? UNKNOWN_IDENTITY;

  return {
    ...calendar,
    employee: { id: employee.id, name: identity.name, email: identity.email ?? "" },
  };
}

export async function setWorkFromHomeDay(userId: string, date: string, enabled: boolean, enforceAllowance = true) {
  if (!isValidDateKey(date)) {
    throw new Error("Invalid date");
  }

  if (isWeekendDateKey(date)) {
    throw new Error("Weekend dates cannot be selected");
  }

  if (isHoliday(date)) {
    throw new Error("Holidays cannot be selected");
  }

  if (enabled) {
    await createWorkFromHomeDay(userId, date, enforceAllowance);
    return;
  }

  await deleteWorkFromHomeDay(userId, date);
}

export async function setWorkFromHomeDayForActor(actor: SessionUser, targetUserId: string, date: string, enabled: boolean) {
  const minimumEditableDate = getMinimumEditableDate(actor.role);
  if (minimumEditableDate && date < minimumEditableDate) {
    throw new Error("No puedes modificar días de teletrabajo anteriores a hoy.");
  }

  await assertCanEditWorkFromHomeDays(actor, targetUserId);
  await setWorkFromHomeDay(targetUserId, date, enabled, actor.role !== "admin");
}

export async function assertCanEditWorkFromHomeDays(actor: SessionUser, targetUserId: string) {
  if (actor.role === "admin") {
    return;
  }

  if (actor.role === "employee") {
    throw new Error("Employees cannot update work-from-home days");
  }

  const actorUser = await findUserById(actor.id);

  if (actorUser?.canEditAllWfh) {
    return;
  }

  if (actor.role === "coordinator") {
    if (targetUserId === actor.id) {
      return;
    }

    const employee = await findEmployeeByCoordinatorId(targetUserId, actor.id);

    if (!employee) {
      throw new Error("Employee is not assigned to this coordinator");
    }
  }
}

export async function replicateWorkFromHomeDays(
  actor: SessionUser,
  input: { month: number; scope: ReplicateWorkFromHomeScope; targetUserId: string; year: number }
) {
  if (!Number.isInteger(input.year) || !Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    throw new Error("Invalid month");
  }

  await assertCanEditWorkFromHomeDays(actor, input.targetUserId);

  const sourceRange = getMonthRange(input.year, input.month);
  const preserveOwnHistory = actor.role === "coordinator" && input.targetUserId === actor.id;
  const effectiveStart = preserveOwnHistory ? (sourceRange.start > getMadridTodayDateKey() ? sourceRange.start : getMadridTodayDateKey()) : sourceRange.start;
  const sourceEntries = await findUserWorkFromHomeDays(input.targetUserId, sourceRange.start, sourceRange.end);
  const sourceWeekdays = new Set(sourceEntries.map((entry) => getWeekdayFromDateKey(entry.date)));

  if (actor.role !== "admin") {
    const targetUser = await findUserById(input.targetUserId);
    if (sourceWeekdays.size > (targetUser?.wfhDaysAllowance ?? 0)) {
      throw new Error("La replicación supera el cupo semanal de teletrabajo.");
    }
  }

  if (sourceWeekdays.size === 0 || (input.scope === "next" && input.month === 12)) {
    return;
  }

  const targetMonths = [
    { year: input.year, month: input.month },
    ...(input.scope === "next" ? [{ year: input.year, month: input.month + 1 }] : getMonthsUntilYearEnd(input.year, input.month)),
  ];
  const values = targetMonths.flatMap(({ year, month }) =>
    getCalendarDays(year, month).cells.flatMap((cell) => {
      if (!cell || cell.date < effectiveStart || cell.isWeekend || cell.isHoliday || !sourceWeekdays.has(getWeekdayFromDateKey(cell.date))) {
        return [];
      }

      return [{ userId: input.targetUserId, date: cell.date }];
    })
  );

  const lastMonth = targetMonths[targetMonths.length - 1];
  const targetRange = getMonthRange(lastMonth.year, lastMonth.month);
  if (effectiveStart <= targetRange.end) {
    await replaceWorkFromHomeDays(input.targetUserId, effectiveStart, targetRange.end, values);
  }
}
