import type { SessionUser } from "@/lib/auth/session";
import { findEmployeeByCoordinatorId, findEmployeesByCoordinatorId } from "@/lib/users/user-repository";
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
  const entries = await findAllWorkFromHomeDays(range.start, range.end);
  const calendar = getCalendarDays(year, month);

  return {
    ...calendar,
    entriesByDate: entries.reduce<Record<string, (typeof entries)[number][]>>((accumulator, entry) => {
      accumulator[entry.date] = accumulator[entry.date] ?? [];
      accumulator[entry.date].push(entry);
      return accumulator;
    }, {}),
  };
}

export async function getCoordinatorCalendarOverview(coordinatorId: string, year: number, month: number, employeeId?: string) {
  const employees = await findEmployeesByCoordinatorId(coordinatorId);
  const visibleEmployees = employeeId ? employees.filter((employee) => employee.id === employeeId) : employees;
  const range = getMonthRange(year, month);
  const entries = await findWorkFromHomeDaysByUserIds(visibleEmployees.map((employee) => employee.id), range.start, range.end);
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
