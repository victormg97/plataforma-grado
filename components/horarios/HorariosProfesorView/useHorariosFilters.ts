'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns/locale';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useNotasCount } from '@/lib/hooks/useNotasCount';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';

type EstadoAsistencia = 'pendiente' | 'confirmado' | 'no_asistio' | 'cancelado' | 'cambiado';
type EstadoFilter = EstadoAsistencia | 'todos';
type ActiveTab = 'proximas' | 'historial';

/* ─── date search helper ── */
function matchesDateQuery(fecha: string, query: string, locale: Locale): boolean {
  if (!query.trim()) return false;
  try {
    const [y, m, d] = fecha.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const q = query.toLowerCase().trim();
    const combined = [
      format(date, 'd/M/yyyy'),
      format(date, 'dd/MM/yyyy'),
      format(date, 'd-M-yyyy'),
      format(date, 'dd-MM-yyyy'),
      format(date, "EEEE d 'de' MMMM 'de' yyyy", { locale }),
      format(date, "EEEE 'de' MMMM 'de' yyyy", { locale }),
      format(date, 'MMMM yyyy', { locale }),
    ].join(' ').toLowerCase();
    return combined.includes(q);
  } catch {
    return false;
  }
}

interface UseHorariosFiltersOptions {
  rawData: HorarioConAsistencia[];
  pruebaHorarioIds: Set<string>;
  dateFnsLocale: Locale;
}

export function useHorariosFilters({ rawData, pruebaHorarioIds, dateFnsLocale }: UseHorariosFiltersOptions) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('proximas');

  /* Proximas tab state */
  const [searchProximas, setSearchProximas] = useState('');
  const [estadoProximas, setEstadoProximas] = useState<EstadoFilter>('todos');
  const [soloPruebasProximas, setSoloPruebasProximas] = useState(false);

  /* Historial tab state */
  const [searchHistorial, setSearchHistorial] = useState('');
  const [historialFilter, setHistorialFilter] = useState<EstadoFilter>('todos');
  const [soloConNotas, setSoloConNotas] = useState(false);
  const [soloPruebas, setSoloPruebas] = useState(false);

  /* Shared */
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(null);

  const debouncedProximas = useDebounce(searchProximas, 280);
  const debouncedHistorial = useDebounce(searchHistorial, 280);

  const today = new Date().toISOString().split('T')[0];

  const upcoming = useMemo(
    () =>
      rawData
        .filter((h) => h.fecha >= today && h.activo)
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio)),
    [rawData, today]
  );

  const past = useMemo(
    () =>
      rawData
        .filter((h) => h.fecha < today)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [rawData, today]
  );

  /* Notas counts for past classes */
  const notableIds = useMemo(
    () =>
      past
        .filter((h) => {
          const e = h.asistencia?.[0]?.estado;
          return e === 'confirmado' || e === 'no_asistio';
        })
        .map((h) => h.id),
    [past]
  );
  const notasCounts = useNotasCount(notableIds);

  /* Available statuses for filter dropdowns */
  const upcomingStatuses = useMemo(() => {
    const seen = new Set<EstadoAsistencia>();
    upcoming.forEach((h) => {
      const e = h.asistencia?.[0]?.estado;
      if (e) seen.add(e);
    });
    return Array.from(seen);
  }, [upcoming]);

  const historialStatuses = useMemo(() => {
    const seen = new Set<EstadoAsistencia>();
    past.forEach((h) => {
      const e = h.asistencia?.[0]?.estado;
      if (e) seen.add(e);
    });
    return Array.from(seen);
  }, [past]);

  /* Whether each filter type has any matching classes (for dynamic chips) */
  const hasUpcomingPruebas = useMemo(
    () => upcoming.some((h) => pruebaHorarioIds.has(h.id)),
    [upcoming, pruebaHorarioIds]
  );
  const hasPastPruebas = useMemo(
    () => past.some((h) => pruebaHorarioIds.has(h.id)),
    [past, pruebaHorarioIds]
  );
  const hasPastNotas = useMemo(
    () => Object.values(notasCounts).some((c) => (c ?? 0) > 0),
    [notasCounts]
  );

  /* Filtered upcoming */
  const filteredUpcoming = useMemo(() => {
    let data = upcoming;
    if (estadoProximas !== 'todos') {
      data = data.filter((h) => (h.asistencia?.[0]?.estado ?? 'pendiente') === estadoProximas);
    }
    if (soloPruebasProximas) {
      data = data.filter((h) => pruebaHorarioIds.has(h.id));
    }
    if (selectedAlumnoId) {
      data = data.filter((h) => h.alumno?.id === selectedAlumnoId);
    }
    if (!debouncedProximas.trim()) return data;
    const q = debouncedProximas.toLowerCase();
    return data.filter(
      (h) => h.titulo.toLowerCase().includes(q) || matchesDateQuery(h.fecha, q, dateFnsLocale)
    );
  }, [upcoming, estadoProximas, soloPruebasProximas, selectedAlumnoId, pruebaHorarioIds, debouncedProximas, dateFnsLocale]);

  /* Filtered historial */
  const filteredHistorial = useMemo(() => {
    let data = past;
    if (historialFilter !== 'todos') {
      data = data.filter((h) => (h.asistencia?.[0]?.estado ?? 'pendiente') === historialFilter);
    }
    if (soloConNotas) {
      data = data.filter((h) => (notasCounts[h.id] ?? 0) > 0);
    }
    if (soloPruebas) {
      data = data.filter((h) => pruebaHorarioIds.has(h.id));
    }
    if (selectedAlumnoId) {
      data = data.filter((h) => h.alumno?.id === selectedAlumnoId);
    }
    if (!debouncedHistorial.trim()) return data;
    const q = debouncedHistorial.toLowerCase();
    return data.filter(
      (h) => h.titulo.toLowerCase().includes(q) || matchesDateQuery(h.fecha, q, dateFnsLocale)
    );
  }, [past, historialFilter, soloConNotas, soloPruebas, notasCounts, pruebaHorarioIds, selectedAlumnoId, debouncedHistorial, dateFnsLocale]);

  return {
    // Tab
    activeTab,
    setActiveTab,
    // Proximas
    searchProximas,
    setSearchProximas,
    estadoProximas,
    setEstadoProximas,
    soloPruebasProximas,
    setSoloPruebasProximas,
    debouncedProximas,
    upcoming,
    filteredUpcoming,
    upcomingStatuses,
    // Historial
    searchHistorial,
    setSearchHistorial,
    historialFilter,
    setHistorialFilter,
    soloConNotas,
    setSoloConNotas,
    soloPruebas,
    setSoloPruebas,
    debouncedHistorial,
    past,
    filteredHistorial,
    historialStatuses,
    notasCounts,
    // Availability flags for dynamic chips
    hasUpcomingPruebas,
    hasPastPruebas,
    hasPastNotas,
    // Shared
    selectedAlumnoId,
    setSelectedAlumnoId,
  };
}
