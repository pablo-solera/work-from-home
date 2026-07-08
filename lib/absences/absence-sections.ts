/**
 * Absence sections shown in the admin calendar modal.
 *
 * Each section maps to one or more Oracle `TTIPOS_DIA.TDIA_ID` values from the
 * TIMERTASK schema. "teletrabajo" has no Oracle type: it comes from Postgres.
 */
export type AbsenceSectionKey = "enOficina" | "teletrabajo" | "vacaciones" | "ausencias" | "bajas" | "viajes" | "permisos" | "excedencia" | "mudanza";

type AbsenceSectionDefinition = {
  key: AbsenceSectionKey;
  label: string;
  tdiaIds: number[];
};

// Order matters: it defines the order of the sections in the modal.
export const ABSENCE_SECTIONS: AbsenceSectionDefinition[] = [
  // "enOficina" and "teletrabajo" have no Oracle day types: they are derived
  // from Postgres (teletrabajo) and computed (enOficina = mapped staff that are
  // neither working from home nor absent on a given working day).
  { key: "enOficina", label: "En oficina", tdiaIds: [] },
  { key: "teletrabajo", label: "Teletrabajo", tdiaIds: [] },

  {
    key: "vacaciones", label: "Vacaciones", tdiaIds: [1, 5, 6, 17, 18, 15, 13
    ]
  },
  { key: "ausencias", label: "Ausencias", tdiaIds: [2] },
  { key: "bajas", label: "Bajas", tdiaIds: [4] },
  { key: "viajes", label: "Viajes", tdiaIds: [3] },
  { key: "permisos", label: "Permisos", tdiaIds: [14] },
  { key: "excedencia", label: "Excedencia", tdiaIds: [16] },
];

const SECTION_BY_TDIA_ID = new Map<number, AbsenceSectionKey>();

for (const section of ABSENCE_SECTIONS) {
  for (const tdiaId of section.tdiaIds) {
    SECTION_BY_TDIA_ID.set(tdiaId, section.key);
  }
}

/** All Oracle TDIA_ID values that map to a visible absence section. */
export const ABSENCE_TDIA_IDS = ABSENCE_SECTIONS.flatMap((section) => section.tdiaIds);

/** Maps an Oracle TDIA_ID to its absence section key, or null if not shown. */
export function getAbsenceSectionKey(tdiaId: number): AbsenceSectionKey | null {
  return SECTION_BY_TDIA_ID.get(tdiaId) ?? null;
}
