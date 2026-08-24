/**
 * Slice `calendario` — mapeo DTO de agenda a evento de FullCalendar (Requisito 12.7).
 *
 * Convierte un `EventoAgendaProyectado` al formato que FullCalendar espera,
 * aplicando el color de la categoría del evento.
 */

import type { EventInput } from '@fullcalendar/core';
import type { EventoAgendaProyectado } from '@/lib/agenda/nucleo';
import { colorDeCategoria } from './colores';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface EventoFullCalendarAgenda extends EventInput {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    tipo: EventoAgendaProyectado['tipo'];
    eventoAgendaId: string;
    categoria: EventoAgendaProyectado['categoria'];
  };
}

// ─── Función de mapeo ───────────────────────────────────────────────────────

/**
 * Transforma un DTO de agenda proyectado al formato de evento de FullCalendar.
 */
export function aEventoFullCalendar(
  evento: EventoAgendaProyectado,
): EventoFullCalendarAgenda {
  const color = colorDeCategoria(evento.categoria);

  return {
    id: evento.id,
    title: evento.titulo,
    start: evento.dia_completo
      ? evento.fecha
      : `${evento.fecha}T${evento.hora_inicio}`,
    end: evento.dia_completo
      ? evento.fecha
      : `${evento.fecha}T${evento.hora_fin}`,
    allDay: evento.dia_completo,
    backgroundColor: color,
    borderColor: color,
    extendedProps: {
      tipo: evento.tipo,
      eventoAgendaId: evento.id,
      categoria: evento.categoria,
    },
  };
}
