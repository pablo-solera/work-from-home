export const WEEKLY_ALLOWANCE_ERROR = "Has alcanzado el cupo semanal de teletrabajo.";

export function hasReachedWeeklyAllowance(usageCount: number, allowance: number) {
  return usageCount >= allowance;
}
