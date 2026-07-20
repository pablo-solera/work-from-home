import { CalendarSkeleton } from "@/components/common/calendar-skeleton";

export default function AdminLoading() {
  return <CalendarSkeleton label="Cargando calendario" withFilter withLinks />;
}
