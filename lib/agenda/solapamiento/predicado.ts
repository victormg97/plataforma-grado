/**
 * Slice `solapamiento` — predicado de solapamiento (Requisitos 6.3, 6.6, 10.11).
 *
 * Función pura, sin efectos, sin acceso a datos, sin estado. Solo puede importar de
 * `compartido` (nivel 0).
 *
 * El predicado es **estricto en los dos lados**: `ra.inicio < rb.fin && ra.fin > rb.inicio`.
 * Los bordes que se tocan NO solapan: `10:00–11:00` y `11:00–12:00` son compatibles
 * (Requisito 6.3). Es simétrico y reflexivo.
 */
import { aMinutos, RANGO_DIA_COMPLETO } from '@/lib/agenda/compartido';

/**
 * Elemento con posición temporal. Es la forma mínima que el predicado necesita para
 * evaluar si dos eventos comparten tiempo.
 */
export interface ElementoTemporal {
  id: string;
  /** `YYYY-MM-DD` */
  fecha: string;
  /** `HH:MM` */
  hora_inicio: string;
  /** `HH:MM` */
  hora_fin: string;
  /** Cuando `true`, el rango se normaliza a `00:00–23:59` (Requisito 6.6). */
  dia_completo?: boolean;
}

/** Rango en minutos desde la medianoche. */
export interface RangoMinutos {
  inicio: number;
  fin: number;
}

/**
 * Calcula el rango efectivo de un elemento en minutos.
 *
 * Si `dia_completo` es `true`, devuelve `RANGO_DIA_COMPLETO` convertido a minutos,
 * ignorando `hora_inicio` y `hora_fin` reales (Requisito 6.6).
 */
export function rangoEfectivo(e: ElementoTemporal): RangoMinutos {
  if (e.dia_completo) {
    return {
      inicio: aMinutos(RANGO_DIA_COMPLETO.hora_inicio),
      fin: aMinutos(RANGO_DIA_COMPLETO.hora_fin),
    };
  }

  return {
    inicio: aMinutos(e.hora_inicio),
    fin: aMinutos(e.hora_fin),
  };
}

/**
 * Predicado de Solapamiento del glosario. Simétrico, reflexivo, y falso cuando los
 * bordes se tocan: `10:00–11:00` y `11:00–12:00` no solapan (Requisito 6.3).
 *
 * Dos elementos con distinta `fecha` nunca solapan (una fecha, Requisito 10.11).
 * Un elemento de día completo se evalúa como `00:00–23:59` (Requisito 6.6).
 *
 * El predicado es **estricto en los dos lados**:
 *   `ra.inicio < rb.fin && ra.fin > rb.inicio`
 */
export function seSolapan(a: ElementoTemporal, b: ElementoTemporal): boolean {
  // Distinta fecha -> nunca solapan (Requisito 10.11)
  if (a.fecha !== b.fecha) return false;

  const ra = rangoEfectivo(a);
  const rb = rangoEfectivo(b);

  // Estricto en los dos lados: los bordes tocándose no cuentan
  return ra.inicio < rb.fin && ra.fin > rb.inicio;
}
