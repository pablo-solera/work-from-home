import type { SessionUser } from "@/lib/auth/session";
import { createEmptySections, type DaySections, getAbsenceSectionsByDate } from "@/lib/absences/absence-service";
import { ABSENCE_SECTIONS } from "@/lib/absences/absence-sections";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { filterVisibleStaff } from "@/lib/employees/staff-service";
import { findAllUsers, findEmployeeByCoordinatorId, findEmployeesByCoordinatorId, findEmployeeTeamVisibility, findUserById } from "@/lib/users/user-repository";
import { findExcludedEmpIds } from "@/lib/employees/org-service";
import { createWorkFromHomeDay, deleteWorkFromHomeDay, findAllWorkFromHomeDays, findUserWorkFromHomeDays, findWorkFromHomeDaysByUserIds, replaceWorkFromHomeDays } from "./calendar-repository";
import { getCalendarDays, getMadridTodayDateKey, getMonthRange, getMonthsUntilYearEnd, getWeekdayFromDateKey, isHoliday, isValidDateKey, isWeekendDateKey } from "./dates";
import { getPendingRequestedDates } from "@/lib/requests/request-service";

export type ReplicateWorkFromHomeScope = "next" | "untilYearEnd";

const UNKNOWN_IDENTITY = { name: "Usuario", email: null } as const;

// Sections (other than "enOficina" itself) whose people are considered NOT in
// the office on a given day: teletrabajo plus every absence section.
const OUT_OF_OFFICE_SECTION_KEYS = ABSENCE_SECTIONS.map((section) => section.key).filter((key) => key !== "enOficina");

export type AdminCalendarDaySummary = {
  absenceCount: number;
  date: string;
  isPast?: boolean;
  officeCount: number;
  remoteCount: number;
};

function buildSectionsByDate(
  entries: Awaited<ReturnType<typeof findAllWorkFromHomeDays>>,
  users: Awaited<ReturnType<typeof findAllUsers>>,
  identities: Awaited<ReturnType<typeof resolveUserIdentities>>,
  absenceSectionsByDate: Record<string, DaySections>,
  calendar: ReturnType<typeof getCalendarDays>,
  excludedEmpIds: Set<number>,
  minimumDate?: string,
) {
  const visibleUserIds = new Set(users.map((user) => user.id));
  const excludedUserIds = new Set(users
    .filter((user) => user.oracleEmpId !== null && excludedEmpIds.has(user.oracleEmpId))
    .map((user) => user.id));
  const sectionsByDate: Record<string, DaySections> = {};
  const absentUserIdsByDate: Record<string, Set<string>> = {};

  for (const [date, sections] of Object.entries(absenceSectionsByDate)) {
    if (minimumDate && date < minimumDate) continue;
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
    if (minimumDate && entry.date < minimumDate) continue;
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

  for (const cell of calendar.cells) {
    if (!cell || cell.isWeekend || cell.isHoliday) {
      continue;
    }
    if (minimumDate && cell.date < minimumDate) continue;

    const sections = sectionsByDate[cell.date];
    const outOfOfficeUserIds = new Set<string>();

    const excludedEntries = users
      .filter((user) => excludedUserIds.has(user.id))
      .map((user) => {
        const identity = identities.get(user.id) ?? UNKNOWN_IDENTITY;
        return { userId: user.id, userName: identity.name, userEmail: identity.email };
      });

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

    const inOffice = officeStaff
      .filter((user) => !outOfOfficeUserIds.has(user.id))
      .map((user) => {
        const identity = identities.get(user.id) ?? UNKNOWN_IDENTITY;
        return { userId: user.id, userName: identity.name, userEmail: identity.email };
      })
      .sort((a, b) => a.userName.localeCompare(b.userName, "es"));

    if (inOffice.length > 0) {
      sectionsByDate[cell.date].enOficina = inOffice;
    }
  }

  return sectionsByDate;
}

function buildDaySummaries(sectionsByDate: Record<string, DaySections>, calendar: ReturnType<typeof getCalendarDays>, minimumDate?: string) {
  const summaries: Record<string, AdminCalendarDaySummary> = {};

  for (const cell of calendar.cells) {
    if (!cell) continue;
    const sections = sectionsByDate[cell.date] ?? createEmptySections();
    const isPast = Boolean(minimumDate && cell.date < minimumDate);
    const absenceCount = ABSENCE_SECTIONS.filter((section) => section.key !== "enOficina" && section.key !== "teletrabajo" && section.key !== "noComprende")
      .reduce((total, section) => total + (isPast ? 0 : sections[section.key].length), 0);
    summaries[cell.date] = {
      date: cell.date,
      isPast,
      officeCount: isPast ? 0 : sections.enOficina.length,
      remoteCount: isPast ? 0 : sections.teletrabajo.length,
      absenceCount,
    };
  }

  return summaries;
}

export async function getUserCalendar(userId: string, year: number, month: number) {
  const range = getMonthRange(year, month);
  const [entries, pendingDates] = await Promise.all([
    findUserWorkFromHomeDays(userId, range.start, range.end),
    getPendingRequestedDates(userId, range.start, range.end),
  ]);
  const selectedDates = new Set(entries.map((entry) => entry.date));
  const calendar = getCalendarDays(year, month);

  return {
    ...calendar,
    selectedDates: Array.from(selectedDates),
    pendingDates,
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
    return filterVisibleStaff(await findEmployeesByCoordinatorId(viewer.id));
  }

  const visibility = await findEmployeeTeamVisibility(viewer.id);
  if (!visibility?.teamWfhVisible) return null;
  return filterVisibleStaff(await findEmployeesByCoordinatorId(visibility.coordinatorId));
}

export async function getEmployeeTeamWfhDayDetail(viewer: SessionUser, date: string) {
  if (!isValidDateKey(date)) return null;
  if (viewer.role !== "employee") return null;
  if (date < getMadridTodayDateKey()) return null;
  const visibility = await findEmployeeTeamVisibility(viewer.id);
  if (!visibility?.teamWfhVisible) return null;

  const users = await filterVisibleStaff(await findEmployeesByCoordinatorId(visibility.coordinatorId));
  const [entries, identities, absenceSectionsByDate, excludedEmpIds] = await Promise.all([
    findWorkFromHomeDaysByUserIds(users.map((user) => user.id), date, date),
    resolveUserIdentities(users),
    getAbsenceSectionsByDate(date, date, users),
    findExcludedEmpIds(),
  ]);
  const calendar = getCalendarDays(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
  const sections = buildSectionsByDate(entries, users, identities, absenceSectionsByDate, calendar, excludedEmpIds, date)[date] ?? createEmptySections();
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
  const sectionsByDate = buildSectionsByDate(entries, users, identities, absenceSectionsByDate, calendar, excludedEmpIds);

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
  const allEmployees = await findEmployeesByCoordinatorId(coordinatorId);
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
  const allEmployees = await findEmployeesByCoordinatorId(coordinatorId);
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

  const employees = await filterVisibleStaff(await findEmployeesByCoordinatorId(teamVisibility.coordinatorId));
  const range = getMonthRange(year, month);
  const calendar = getCalendarDays(year, month);
  const today = getMadridTodayDateKey();
  const start = range.start > today ? range.start : today;
  const [entries, identities, absenceSectionsByDate, excludedEmpIds] = await Promise.all([
    start <= range.end ? findWorkFromHomeDaysByUserIds(employees.map((employee) => employee.id), start, range.end) : Promise.resolve([]),
    resolveUserIdentities(employees),
    start <= range.end ? getAbsenceSectionsByDate(start, range.end, employees) : Promise.resolve({}),
    findExcludedEmpIds(),
  ]);
  const sectionsByDate = buildSectionsByDate(entries, employees, identities, absenceSectionsByDate, calendar, excludedEmpIds, today);

  return {
    ...calendar,
    daySummariesByDate: buildDaySummaries(sectionsByDate, calendar, today),
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

export async function setWorkFromHomeDay(userId: string, date: string, enabled: boolean) {
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
    await createWorkFromHomeDay(userId, date);
    return;
  }

  await deleteWorkFromHomeDay(userId, date);
}

export async function setWorkFromHomeDayForActor(actor: SessionUser, targetUserId: string, date: string, enabled: boolean) {
  if (actor.role !== "admin" && date < getMadridTodayDateKey()) {
    throw new Error("No puedes modificar días de teletrabajo anteriores a hoy.");
  }

  await assertCanEditWorkFromHomeDays(actor, targetUserId);
  await setWorkFromHomeDay(targetUserId, date, enabled);
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
