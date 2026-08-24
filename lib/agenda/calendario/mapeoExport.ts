/**
 * Slice `calendario` — mapeo DTO de agenda a fila de exportación PDF (Requisito 12.7).
 *
 * Convierte un `EventoAgendaProyectado` a la interfaz `CalendarioExportEvent` que
 * usan las utilidades de exportación a PDF del calendario.
 */

import type { EventoAgendaProyectado } from '@/lib/agenda/nucleo';
import type { CalendarioExportEvent } from '@/lib/utils/calendarExport';
import { colorDeCategoria } from './colores';

// ─── Función de mapeo ───────────────────────────────────────────────────────

/**
 * Transforma un DTO de agenda proyectado a una fila de exportación para el PDF.
 *
 * @param evento - Evento proyectado del Rango_Visible.
 * @param resolverColor - Función que resuelve una variable CSS a un valor hexadecimal.
 *   Necesaria porque jsPDF trabaja con hex, no con variables CSS.
 */
export function aFilaExportacion(
  evento: EventoAgendaProyectado,
  resolverColor: (cssVar: string) => string,
): CalendarioExportEvent {
  const cssVar = colorDeCategoria(evento.categoria);
  const hex = resolverColor(cssVar);

  const fechaBase = evento.fecha; // YYYY-MM-DD

  const start = evento.dia_completo
    ? new Date(`${fechaBase}T00:00:00`)
    : new Date(`${fechaBase}T${evento.hora_inicio}:00`);

  const end = evento.dia_completo
    ? new Date(`${fechaBase}T23:59:00`)
    : new Date(`${fechaBase}T${evento.hora_fin}:00`);

  return {
    id: evento.id,
    title: evento.titulo,
    start,
    end,
    color: hex,
    subtitle: evento.autor.nombre
      ? `${evento.autor.nombre} ${evento.autor.apellido}`
      : undefined,
  };
}
