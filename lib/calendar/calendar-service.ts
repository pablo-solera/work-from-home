import type { SessionUser } from "@/lib/auth/session";
import { findAllUsers, findEmployeeByCoordinatorId, findEmployeesByCoordinatorId, findEmployeeTeamVisibility, findUserById } from "@/lib/users/user-repository";
import { createWorkFromHomeDay, deleteWorkFromHomeDay, findAllWorkFromHomeDays, findUserWorkFromHomeDays, findWorkFromHomeDaysByUserIds } from "./calendar-repository";
import { getCalendarDays, getMonthRange, isHoliday, isValidDateKey, isWeekendDateKey } from "./dates";

export async function getUserCalendar(userId: string, year: number, month: number) {
  const range = getMonthRange(year, month);
  const entries = await findUserWorkFromHomeDays(userId, range.start, range.end);
  const selectedDates = new Set(entries.map((entry) => entry.date));
  const calendar = getCalendarDays(year, month);

  return {
    ...calendar,
    selectedDates: Array.from(selectedDates),
  };
}

export async function getAdminCalendarOverview(year: number, month: number) {
  const range = getMonthRange(year, month);
  const [entries, users] = await Promise.all([findAllWorkFromHomeDays(range.start, range.end), findAllUsers()]);
  const calendar = getCalendarDays(year, month);

  return {
    ...calendar,
    users: users.map((user) => ({ id: user.id, name: user.name, email: user.email })),
    entriesByDate: entries.reduce<Record<string, (typeof entries)[number][]>>((accumulator, entry) => {
      accumulator[entry.date] = accumulator[entry.date] ?? [];
      accumulator[entry.date].push(entry);
      return accumulator;
    }, {}),
  };
}

export async function getAdminUserCalendar(userId: string, year: number, month: number) {
  const user = await findUserById(userId);

  if (!user) {
    return null;
  }

  const calendar = await getUserCalendar(user.id, year, month);

  return {
    ...calendar,
    user: { id: user.id, name: user.name, email: user.email },
  };
}

export async function getCoordinatorCalendarOverview(coordinatorId: string, year: number, month: number, employeeId?: string) {
  const employees = await findEmployeesByCoordinatorId(coordinatorId);
  const visibleEmployees = employeeId ? employees.filter((employee) => employee.id === employeeId) : employees;
  const visibleUserIds = employeeId ? visibleEmployees.map((employee) => employee.id) : [coordinatorId, ...visibleEmployees.map((employee) => employee.id)];
  const range = getMonthRange(year, month);
  const entries = await findWorkFromHomeDaysByUserIds(visibleUserIds, range.start, range.end);
  const calendar = getCalendarDays(year, month);

  return {
    ...calendar,
    employees: employees.map((employee) => ({ id: employee.id, name: employee.name, email: employee.email })),
    entriesByDate: entries.reduce<Record<string, (typeof entries)[number][]>>((accumulator, entry) => {
      accumulator[entry.date] = accumulator[entry.date] ?? [];
      accumulator[entry.date].push(entry);
      return accumulator;
    }, {}),
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

  const calendar = await getUserCalendar(employee.id, year, month);

  return {
    ...calendar,
    employee: { id: employee.id, name: employee.name, email: employee.email },
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
  if (actor.role === "admin") {
    await setWorkFromHomeDay(targetUserId, date, enabled);
    return;
  }

  const actorUser = await findUserById(actor.id);

  if (actorUser?.canEditAllWfh) {
    await setWorkFromHomeDay(targetUserId, date, enabled);
    return;
  }

  if (actor.role === "employee") {
    throw new Error("Employees cannot update work-from-home days");
  }

  if (actor.role === "coordinator") {
    if (targetUserId === actor.id) {
      await setWorkFromHomeDay(targetUserId, date, enabled);
      return;
    }

    const employee = await findEmployeeByCoordinatorId(targetUserId, actor.id);

    if (!employee) {
      throw new Error("Employee is not assigned to this coordinator");
    }
  }

  await setWorkFromHomeDay(targetUserId, date, enabled);
}
