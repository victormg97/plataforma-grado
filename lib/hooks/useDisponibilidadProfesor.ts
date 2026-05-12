'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDebounce } from './useDebounce';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DisponibilidadParams = {
  profesor_id?: string | null;
  fecha?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
};

export type UseDisponibilidadProfesorResult = {
  disponible: boolean;
  loading: boolean;
  error: string | null;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Client-side hook that checks profesor availability for a given date/time range.
 * Queries both `horarios` (active classes) and `solicitudes_cambio_horario` (pending requests)
 * for overlapping time slots.
 *
 * Uses debouncing (500ms) to avoid excessive queries as the user types/selects times.
 * Only runs the query when all params are provided.
 */
export function useDisponibilidadProfesor(
  params: DisponibilidadParams
): UseDisponibilidadProfesorResult {
  const [disponible, setDisponible] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce the params to avoid excessive queries
  const debouncedParams = useDebounce(params, 500);

  // Track the latest request to avoid stale responses
  const requestIdRef = useRef(0);

  const { profesor_id, fecha, hora_inicio, hora_fin } = debouncedParams;

  // All params must be present to run the check
  const allParamsPresent = !!(profesor_id && fecha && hora_inicio && hora_fin);

  useEffect(() => {
    // Reset state when params are incomplete
    if (!allParamsPresent) {
      setDisponible(true);
      setLoading(false);
      setError(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;

    async function checkDisponibilidad() {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        // Check for overlapping active horarios
        const { data: horarioConflict, error: horarioError } = await supabase
          .from('horarios')
          .select('id')
          .eq('profesor_id', profesor_id!)
          .eq('fecha', fecha!)
          .eq('activo', true)
          .lt('hora_inicio', hora_fin!)
          .gt('hora_fin', hora_inicio!)
          .limit(1);

        if (horarioError) {
          throw new Error(horarioError.message);
        }

        // If this request is stale, discard
        if (currentRequestId !== requestIdRef.current) return;

        // Check for overlapping pending solicitudes
        const { data: solicitudConflict, error: solicitudError } = await supabase
          .from('solicitudes_cambio_horario')
          .select('id')
          .eq('profesor_id', profesor_id!)
          .eq('fecha_propuesta', fecha!)
          .eq('estado', 'pendiente')
          .lt('hora_inicio_propuesta', hora_fin!)
          .gt('hora_fin_propuesta', hora_inicio!)
          .limit(1);

        if (solicitudError) {
          throw new Error(solicitudError.message);
        }

        // If this request is stale, discard
        if (currentRequestId !== requestIdRef.current) return;

        const hasConflict =
          (horarioConflict && horarioConflict.length > 0) ||
          (solicitudConflict && solicitudConflict.length > 0);

        setDisponible(!hasConflict);
      } catch (err) {
        // Only update state if this is still the latest request
        if (currentRequestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Error al verificar disponibilidad');
        setDisponible(false);
      } finally {
        // Only update loading if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    checkDisponibilidad();
  }, [allParamsPresent, profesor_id, fecha, hora_inicio, hora_fin]);

  return { disponible, loading, error };
}
