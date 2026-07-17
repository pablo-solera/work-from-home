import { MonthCalendar, type MonthCalendarProps } from "./month-calendar";

type CalendarVariantProps = Omit<MonthCalendarProps, "canEdit" | "canRequest">;

export function EditableMonthCalendar(props: CalendarVariantProps) {
  return <MonthCalendar {...props} canEdit />;
}

export function RequestableMonthCalendar(props: CalendarVariantProps) {
  return <MonthCalendar {...props} canEdit={false} canRequest />;
}
