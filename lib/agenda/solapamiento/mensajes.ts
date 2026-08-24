/**
 * Slice `solapamiento` — construcción de Advertencia_Solapamiento (Requisitos 6.7, 7.2).
 *
 * Función pura, sin efectos, sin acceso a datos, sin estado. Convierte un
 * `ElementoTemporal` ampliado (con `tipo` y `titulo`) en un `ConflictoAgenda` listo
 * para incluir en la respuesta de la API.
 *
 * Solo puede importar de `compartido` (nivel 0) y de archivos del propio slice.
 */
import { normalizarHora, type ConflictoAgenda } from '@/lib/agenda/compartido';

import type { ElementoTemporal } from './predicado';

/** Entrada con los campos adicionales que requiere la advertencia. */
export interface ElementoConMeta extends ElementoTemporal {
  tipo: ConflictoAgenda['tipo'];
  titulo: string;
}

/**
 * Convierte un elemento temporal con metadatos en un `ConflictoAgenda`.
 *
 * Normaliza las horas con `normalizarHora` del slice `compartido` para que el
 * resultado siempre tenga el formato `HH:MM`, independientemente de si el origen
 * entregó `HH:MM:SS` o `H:MM`.
 */
export function aAdvertencia(elemento: ElementoConMeta): ConflictoAgenda {
  return {
    tipo: elemento.tipo,
    id: elemento.id,
    titulo: elemento.titulo,
    fecha: elemento.fecha,
    hora_inicio: normalizarHora(elemento.hora_inicio),
    hora_fin: normalizarHora(elemento.hora_fin),
  };
}
