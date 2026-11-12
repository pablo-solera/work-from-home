import type { AbsenceSectionKey } from "@/lib/absences/absence-sections";

// Full class names so Tailwind can detect them. Absence colors come from TimerTask (TTIPOS_DIA.TDIA_COLOR).
export const SECTION_STYLES: Record<AbsenceSectionKey, { dot: string; soft: string }> = {
  enOficina: { dot: "bg-zinc-500", soft: "bg-zinc-100" },
  teletrabajo: { dot: "bg-indigo-600", soft: "bg-indigo-50" },
  vacaciones: { dot: "bg-tdia-vacaciones", soft: "bg-tdia-vacaciones/10" },
  ausencias: { dot: "bg-tdia-ausencias", soft: "bg-tdia-ausencias/15" },
  bajas: { dot: "bg-tdia-bajas", soft: "bg-tdia-bajas/15" },
  viajes: { dot: "bg-tdia-viajes", soft: "bg-tdia-viajes/15" },
  permisos: { dot: "bg-tdia-permisos", soft: "bg-tdia-permisos/10" },
  excedencia: { dot: "bg-tdia-excedencia", soft: "bg-tdia-excedencia/10" },
  mudanza: { dot: "bg-tdia-mudanza", soft: "bg-tdia-mudanza/10" },
  noComprende: { dot: "bg-zinc-300", soft: "bg-zinc-50" },
};
