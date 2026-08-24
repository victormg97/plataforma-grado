/**
 * Slice `visibilidad` — proyección de filas a DTOs con recorte de campos
 * (Requisitos 8.9, 8.10).
 *
 * Transforma `FilaEventoConAutor` (de `nucleo`) en la unión discriminada
 * `EventoAgendaProyectado`. Devuelve `null` cuando el lector no puede ver la fila,
 * de modo que una fuga de RLS no filtra datos sensibles al cliente.
 *
 * Variantes de lectura:
 *  - `completa`: el lector es el Autor o es un Destinatario_Vigente de la Actividad.
 *    Incluye `descripcion` y `nota`.
 *  - `parcial`: entrada pública ajena legible. SIN `descripcion` ni `nota`.
 *
 * Dependencias: `@/lib/agenda/nucleo` (tipos y mapeo), `./matriz` (guardas puras).
 */
import type { AgendaAlcance, AgendaVisibilidad } from '@/lib/supabase/types';
import type {
  EventoAgendaProyectado,
  FilaEventoAgenda,
} from '@/lib/agenda/nucleo';
import {
  aEventoAgendaAjeno,
  aEventoAgendaPropio,
  type FilaEventoConAutor,
} from '@/lib/agenda/nucleo';

import { puedeEditarEvento, puedeLeerEntradaPersonal } from './matriz';
import type { ContextoLector } from './matriz';

/**
 * Entrada enriquecida para la proyección. La ruta de API aporta los
 * `destinatarioIds` que la consulta ya resolvió (de `agenda_evento_destinatarios`),
 * de modo que la proyección no necesita otra query.
 */
export interface EntradaProyeccion {
  fila: FilaEventoConAutor;
  /** IDs de los Destinatarios_Explicitos. Vacío para Entradas_Personales. */
  destinatarioIds: ReadonlySet<string>;
}

/**
 * Proyecta una fila a la variante de lectura que corresponde al lector.
 *
 * Devuelve `null` cuando el lector no puede ver la fila (Req 8.3 y siguientes).
 * Un `null` en una fila que RLS debería haber excluido es la segunda barrera de
 * seguridad descrita en la decisión de diseño 4.
 */
export function proyectarEvento(
  entrada: EntradaProyeccion,
  lector: ContextoLector,
): EventoAgendaProyectado | null {
  const { fila, destinatarioIds } = entrada;
  const { autor } = fila;

  // ── Decisión de visibilidad para Entradas_Personales ──────────────────────
  if (fila.alcance === 'personal') {
    if (
      !puedeLeerEntradaPersonal(
        lector,
        autor,
        fila.visibilidad as AgendaVisibilidad,
      )
    ) {
      return null;
    }
  }

  // ── Determinar si el lector tiene lectura completa ────────────────────────
  const esAutor = lector.id === autor.id;
  const esDestinatario = destinatarioIds.has(lector.id);
  const lecturaCompleta = esAutor || esDestinatario;

  // ── Resolver puede_editar sin otra consulta (Req 12.5) ────────────────────
  const puede_editar = puedeEditarEvento(lector, {
    alcance: fila.alcance as AgendaAlcance,
    autorId: autor.id,
  });

  // ── Construir el DTO usando las funciones existentes de nucleo/mapeo ──────
  const contexto = { autor, puede_editar, oculto: false };

  // FilaEventoConAutor usa `string` en lugar de los enums de FilaEventoAgenda
  // porque Supabase lo devuelve así en el join. El cast es seguro: los valores
  // vienen de columnas con constraint de enum en la base de datos.
  const filaComoRow = fila as unknown as FilaEventoAgenda;

  if (lecturaCompleta) {
    return aEventoAgendaPropio(filaComoRow, contexto);
  }

  // Variante parcial: sin descripcion ni nota (Req 8.10).
  return aEventoAgendaAjeno(filaComoRow, contexto);
}

/**
 * Proyecta un array de filas, filtrando los `null` (filas que el lector no puede
 * ver). Devuelve un array limpio de `EventoAgendaProyectado`.
 */
export function proyectarEventos(
  entradas: EntradaProyeccion[],
  lector: ContextoLector,
): EventoAgendaProyectado[] {
  const resultado: EventoAgendaProyectado[] = [];

  for (const entrada of entradas) {
    const proyeccion = proyectarEvento(entrada, lector);
    if (proyeccion !== null) {
      resultado.push(proyeccion);
    }
  }

  return resultado;
}
