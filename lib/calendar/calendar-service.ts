import type { SessionUser } from "@/lib/auth/session";
import { createEmptySections, type DaySections, getAbsenceSectionsByDate } from "@/lib/absences/absence-service";
import { ABSENCE_SECTIONS } from "@/lib/absences/absence-sections";
import { resolveUserIdentities } from "@/lib/employees/identity-service";
import { filterVisibleStaff } from "@/lib/employees/staff-service";
import { findAllUsers, findEmployeeByCoordinatorId, findEmployeesByCoordinatorId, findEmployeeTeamVisibility, findUserById } from "@/lib/users/user-repository";
import { createWorkFromHomeDay, deleteWorkFromHomeDay, findAllWorkFromHomeDays, findUserWorkFromHomeDays, findWorkFromHomeDaysByUserIds, replaceWorkFromHomeDays } from "./calendar-repository";
import { getCalendarDays, getMonthRange, getMonthsUntilYearEnd, getWeekdayFromDateKey, isHoliday, isValidDateKey, isWeekendDateKey } from "./dates";
import { getPendingRequestedDates } from "@/lib/requests/request-service";

export type ReplicateWorkFromHomeScope = "next" | "untilYearEnd";

const UNKNOWN_IDENTITY = { name: "Usuario", email: null } as const;

// Sections (other than "enOficina" itself) whose people are considered NOT in
// the office on a given day: teletrabajo plus every absence section.
const OUT_OF_OFFICE_SECTION_KEYS = ABSENCE_SECTIONS.map((section) => section.key).filter((key) => key !== "enOficina");

function buildSectionsByDate(
  entries: Awaited<ReturnType<typeof findAllWorkFromHomeDays>>,
  users: Awaited<ReturnType<typeof findAllUsers>>,
  identities: Awaited<ReturnType<typeof resolveUserIdentities>>,
  absenceSectionsByDate: Record<string, DaySections>,
  calendar: ReturnType<typeof getCalendarDays>,
) {
  const visibleUserIds = new Set(users.map((user) => user.id));
  const sectionsByDate: Record<string, DaySections> = {};
  const absentUserIdsByDate: Record<string, Set<string>> = {};

  for (const [date, sections] of Object.entries(absenceSectionsByDate)) {
    const filtered = createEmptySections();
    const absentIds = new Set<string>();

    for (const key of Object.keys(sections) as (keyof DaySections)[]) {
      filtered[key] = sections[key]
        .filter((entry) => entry.userId !== null && visibleUserIds.has(entry.userId))
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
    if (!visibleUserIds.has(entry.userId) || absentUserIdsByDate[entry.date]?.has(entry.userId)) {
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

  const officeStaff = users.filter((user) => user.oracleEmpId !== null && user.oracleEmpId !== undefined);

  for (const cell of calendar.cells) {
    if (!cell || cell.isWeekend || cell.isHoliday) {
      continue;
    }

    const sections = sectionsByDate[cell.date];
    const outOfOfficeUserIds = new Set<string>();

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
      sectionsByDate[cell.date] = sectionsByDate[cell.date] ?? createEmptySections();
      sectionsByDate[cell.date].enOficina = inOffice;
    }
  }

  return sectionsByDate;
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
  const [absenceSectionsByDate, users, identities] = await Promise.all([
    getAbsenceSectionsByDate(range.start, range.end, allUsers),
    filterVisibleStaff(allUsers),
    resolveUserIdentities(allUsers),
  ]);
  const sectionsByDate = buildSectionsByDate(entries, users, identities, absenceSectionsByDate, calendar);

  const userList = users
    .map((user) => {
      const identity = identities.get(user.id) ?? UNKNOWN_IDENTITY;
      return { id: user.id, name: identity.name, email: identity.email ?? "" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    ...calendar,
    users: userList,
    sectionsByDate,
  };
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

  const [entries, identities, absenceSectionsByDate] = await Promise.all([
    findWorkFromHomeDaysByUserIds(visibleUserIds, range.start, range.end),
    resolveUserIdentities(employees),
    getAbsenceSectionsByDate(range.start, range.end, employees),
  ]);
  const sectionsByDate = buildSectionsByDate(entries, visibleEmployees, identities, absenceSectionsByDate, calendar);

  const employeeList = employees
    .map((employee) => {
      const identity = identities.get(employee.id) ?? UNKNOWN_IDENTITY;
      return { id: employee.id, name: identity.name, email: identity.email ?? "" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    ...calendar,
    employees: employeeList,
    sectionsByDate,
  };
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

  return getCoordinatorCalendarOverview(teamVisibility.coordinatorId, year, month);
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
  await assertCanEditWorkFromHomeDays(actor, targetUserId);
  await setWorkFromHomeDay(targetUserId, date, enabled);
}

async function assertCanEditWorkFromHomeDays(actor: SessionUser, targetUserId: string) {
  if (actor.role === "admin") {
    return;
  }

  const actorUser = await findUserById(actor.id);

  if (actorUser?.canEditAllWfh) {
    return;
  }

  if (actor.role === "employee") {
    throw new Error("Employees cannot update work-from-home days");
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
      if (!cell || cell.isWeekend || cell.isHoliday || !sourceWeekdays.has(getWeekdayFromDateKey(cell.date))) {
        return [];
      }

      return [{ userId: input.targetUserId, date: cell.date }];
    })
  );

  const lastMonth = targetMonths[targetMonths.length - 1];
  const targetRange = getMonthRange(lastMonth.year, lastMonth.month);
  await replaceWorkFromHomeDays(input.targetUserId, sourceRange.start, targetRange.end, values);
}
