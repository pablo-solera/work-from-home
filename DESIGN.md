# DESIGN.md

Sistema visual de `work-from-home`. Es una herramienta interna de uso diario (modo *Operate*): prima la lectura rápida, la consistencia y el teclado sobre la expresión. Texto visible siempre en español.

## Principios

- **Sobrio y funcional.** Base neutra (zinc) sobre fondo `#fafafa`, acento negro (`zinc-950`) para la acción principal y cielo (`sky`) para el flujo de solicitudes.
- **Un color, un significado**, igual en todas las vistas (ver tabla).
- **Bordes antes que sombras.** Tarjetas con `border-zinc-200` y `shadow-panel` muy suave; `shadow-dialog` solo en modales y menús.
- **Sin dependencias de UI.** Tailwind + `lucide-react` solo para iconos. Los componentes base viven en `components/common/`.
- **Compatible con la CSP de producción:** nada de `style={}`. Todo con clases; los valores dinámicos se resuelven con clases completas (mapas de nombres estáticos).

## Color

| Significado | Color | Uso |
|---|---|---|
| Teletrabajo | `indigo` (600 punto, 50 fondo, 800/900 texto) | celdas, contadores, chips |
| En oficina | `zinc-500` | punto y contador |
| Pendiente | `amber-500` | solicitud pendiente |
| Solicitudes | `sky` | banners, pestañas, "Nueva" |
| Éxito / Peligro | `emerald-700` / `red-700` | aceptar, rechazar, errores |
| Ausencias por tipo | colores de TimerTask (`--color-tdia-*`) | punto y fondo suave de cada sección del día |

Los `--color-tdia-*` de `app/globals.css` salen de `TIMERTASK_ES.TTIPOS_DIA.TDIA_COLOR`: vacaciones `#ff3333`, ausencias `#ff99cc`, viajes `#8fc95f`, bajas `#66cccc`, permisos `#1f89ff`, excedencia `#b261f0`, mudanza `#ff3399`, festivo/fin de semana `#999999`. Muchos no alcanzan contraste AA como texto: se usan **solo** como punto o fondo al 10-15 %; el texto va siempre en zinc oscuro.

El mapa sección → clases está en `components/admin/day-section-styles.ts`.

## Tipografía

Geist (sans) y Geist Mono, cargadas con `next/font` y conectadas en `@theme inline`. Títulos de página `text-2xl sm:text-3xl font-semibold tracking-tight text-balance`. Texto base `text-sm`; inputs `text-base` en móvil para evitar el zoom de iOS. Cifras con `tabular-nums`. No se usan *eyebrows* sobre los títulos.

## Componentes base (`components/common/`)

- `button.tsx`: `Button` y `buttonClasses(variant, size)`. Variantes `primary`, `secondary`, `ghost`, `danger`, `success`; tamaños `md` (44 px), `sm` (36 px), `icon` (44 px).
- `badge.tsx`: pastilla con punto de color. Tonos `dark`, `neutral`, `remote`, `pending`, `info`, `success`, `danger`.
- `dialog.tsx`: `Dialog` + `Panel`, `Header`, `Title`, `Close`, `Body`, `Actions`. Hoja inferior en móvil, centrado desde `sm`. `padded={false}` para estructurar cabecera fija, cuerpo con scroll y pie.
- `confirm-dialog.tsx`: sustituye a `window.confirm`.
- `empty-state.tsx`, `form-classes.ts` (`fieldClasses`), `toast-provider.tsx` (`success`, `error`, `info`), `generated-avatar.tsx` (color estable según el nombre).

## Interacción

- **Foco:** un único anillo global (`:focus-visible`, `sky-700`, offset 2 px). Los componentes no lo sobrescriben.
- **Modales:** `lib/hooks/use-modal-dismiss.ts` gestiona Esc, trampa de Tab, bloqueo de scroll y devolución de foco. Con varios modales abiertos solo responde el superior.
- **Movimiento:** entradas cortas (140-220 ms, `ease-out-expo`). `prefers-reduced-motion` lo desactiva todo globalmente.
- **Modal del día:** buscador (`/` lo enfoca, Esc lo borra o cierra), chips de sección que filtran, `←`/`→` cambian de día.

## Responsive

Calendarios compactos en móvil: celdas `min-h-20` con número y puntos; el texto aparece desde `sm`. La cabecera pasa a menú desplegable por debajo de `md` (`components/layout/app-nav.tsx`).

## Pruebas que dependen de la UI

Los tests no comprueban clases, pero sí textos, roles y `aria-label` (p. ej. "Marcar teletrabajo el …", "Sí, rechazar", "Limpiar filtros", pestañas con contador dentro del enlace) y los nombres de export de los componentes mockeados en `tests/unit/calendar-pages.test.tsx`.
