'use client';

/**
 * Slice `solapamiento` — aviso previo de conflicto en el formulario (Requisito 6.10).
 *
 * Evalúa el solapamiento del candidato contra los elementos ya cargados en la vista,
 * con un debounce de 400 ms para no recalcular en cada pulsación. El servidor valida
 * igual (Requisito 6.11): este aviso es comodidad, no seguridad.
 *
 * Dependencias permitidas: `compartido`, `nucleo`, propios del slice, `lib/hooks`.
 */
import { useMemo } from 'react';

import type { AdvertenciaSolapamiento } from '@/lib/agenda/nucleo';
import { useDebounce } from '@/lib/hooks/useDebounce';

import { evaluarSolapamiento } from '../evaluador';
import type { ElementoTemporal } from '../predicado';

/**
 * Comprueba que el candidato parcial tiene los campos mínimos para evaluar
 * solapamiento: id, fecha, hora_inicio, hora_fin.
 */
function esCompleto(
  candidato: Partial<ElementoTemporal>,
): candidato is ElementoTemporal {
  return (
    typeof candidato.id === 'string' &&
    typeof candidato.fecha === 'string' &&
    typeof candidato.hora_inicio === 'string' &&
    typeof candidato.hora_fin === 'string' &&
    candidato.fecha.length > 0 &&
    candidato.hora_inicio.length > 0 &&
    candidato.hora_fin.length > 0
  );
}

export interface ResultadoConflictoLocal {
  conflictos: AdvertenciaSolapamiento[];
  /** `true` solo cuando `modo === 'bloqueante'` Y hay conflictos. */
  guardadoDeshabilitado: boolean;
}

/**
 * Hook que evalúa el solapamiento de un candidato contra los elementos del calendario.
 *
 * @param candidato - Campos del formulario (puede estar incompleto mientras edita).
 * @param elementos - Elementos ya cargados en la vista del calendario.
 * @param modo - `'bloqueante'` para alumno (deshabilita guardar), `'advertencia'` para editor.
 * @returns Conflictos detectados y bandera de guardado.
 */
export function useConflictoLocal(
  candidato: Partial<ElementoTemporal>,
  elementos: AdvertenciaSolapamiento[],
  modo: 'bloqueante' | 'advertencia',
): ResultadoConflictoLocal {
  // Debounce de 400 ms: el aviso aparece dentro del plazo de 500 ms del Requisito 6.10
  const estable = useDebounce(candidato, 400);

  const conflictos = useMemo(
    () => (esCompleto(estable) ? evaluarSolapamiento(estable, elementos) : []),
    [estable, elementos],
  );

  return {
    conflictos,
    guardadoDeshabilitado: modo === 'bloqueante' && conflictos.length > 0,
  };
}
