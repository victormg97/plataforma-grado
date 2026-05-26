'use client';
/* eslint-disable react-hooks/refs */

import { useMemo, useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Tooltip } from '@/components/common/Tooltip';
import { PagoPopup, type PagoEstado } from '@/components/pagos/PagoPopup';
import type { AlumnoResumenAnual } from '@/app/api/admin/pagos/resumen/route';

import { AlumnoRow } from './components/AlumnoRow';
import { LegendSection } from './components/LegendSection';
import { GridSkeleton } from './components/GridSkeleton';

// ─── Constants ────────────────────────────────────────────────────────────────

const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenPopup {
  alumnoId: string;
  mes: number;
}

interface AnualTabProps {
  año: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnualTab({ año }: AnualTabProps) {
  const t = useTranslations('pagos');
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showGraduados, setShowGraduados] = useState(false);
  const [openPopup, setOpenPopup] = useState<OpenPopup | null>(null);
  const [openColPopup, setOpenColPopup] = useState<number | null>(null);

  // Map of button refs: key = `${alumnoId}-${mes}`
  const buttonRefs = useRef<Map<string, React.RefObject<HTMLButtonElement | null>>>(new Map());
  // Map of column header button refs: key = mes
  const colHeaderRefs = useRef<Map<number, React.RefObject<HTMLButtonElement | null>>>(new Map());

  const getButtonRef = useCallback((alumnoId: string, mes: number) => {
    const key = `${alumnoId}-${mes}`;
    if (!buttonRefs.current.has(key)) {
      buttonRefs.current.set(key, { current: null });
    }
    return buttonRefs.current.get(key)!;
  }, []);

  const getColHeaderRef = useCallback((mes: number) => {
    if (!colHeaderRefs.current.has(mes)) {
      colHeaderRefs.current.set(mes, { current: null });
    }
    return colHeaderRefs.current.get(mes)!;
  }, []);

  const { data: resumen = [], isLoading, isError } = useQuery<AlumnoResumenAnual[]>({
    queryKey: ['admin-pagos-anual', año],
    queryFn: async () => {
      const r = await fetch(`/api/admin/pagos/resumen?año=${año}`);
      if (!r.ok) throw new Error('Error');
      return r.json();
    },
    staleTime: 60_000,
  });

  const { mutate: savePago } = useMutation({
    mutationFn: async (payload: {
      alumno_id: string;
      año: number;
      mes: number;
      estado: 'pagado' | 'pendiente';
      monto_pagado?: number;
    }) => {
      const r = await fetch('/api/admin/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? 'Error');
      }
      return r.json();
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['admin-pagos-anual', año] });
      const prev = queryClient.getQueryData<AlumnoResumenAnual[]>(['admin-pagos-anual', año]);
      queryClient.setQueryData<AlumnoResumenAnual[]>(['admin-pagos-anual', año], (old = []) =>
        old.map((a) =>
          a.alumno_id !== payload.alumno_id
            ? a
            : {
                ...a,
                pagos: a.pagos.map((p) =>
                  p.mes !== payload.mes
                    ? p
                    : {
                        ...p,
                        estado: payload.estado === 'pendiente' ? null : payload.estado,
                        monto_pagado: payload.monto_pagado ?? null,
                      }
                ),
              }
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['admin-pagos-anual', año], ctx.prev);
      toast.error(t('error_marcar'));
    },
    onSuccess: () => {
      toast.success(t('exito_marcado'));
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pagos-anual', año] });
      queryClient.invalidateQueries({ queryKey: ['admin-pagos', año, vars.mes] });
    },
  });

  const { mutate: saveColumna } = useMutation({
    mutationFn: async (payload: { año: number; mes: number; estado: 'pagado' | 'pendiente'; monto_pagado?: number }) => {
      const r = await fetch('/api/admin/pagos/columna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? 'Error');
      }
      return r.json();
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['admin-pagos-anual', año] });
      const prev = queryClient.getQueryData<AlumnoResumenAnual[]>(['admin-pagos-anual', año]);
      queryClient.setQueryData<AlumnoResumenAnual[]>(['admin-pagos-anual', año], (old = []) =>
        old.map((a) => ({
          ...a,
          pagos: a.pagos.map((p) =>
            p.mes !== payload.mes
              ? p
              : {
                  ...p,
                  estado: payload.estado === 'pendiente' ? null : payload.estado,
                  monto_pagado: payload.monto_pagado ?? null,
                }
          ),
        }))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['admin-pagos-anual', año], ctx.prev);
      toast.error(t('error_columna'));
    },
    onSuccess: () => {
      toast.success(t('exito_columna'));
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pagos-anual', año] });
      queryClient.invalidateQueries({ queryKey: ['admin-pagos', año, vars.mes] });
    },
  });

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase();
    return resumen.filter((a) => !q || `${a.nombre} ${a.apellido}`.toLowerCase().includes(q));
  }, [resumen, searchText]);

  const activeAlumnos = useMemo(() => filtered.filter((a) => a.activo && !a.paso_prueba), [filtered]);
  const inactiveAlumnos = useMemo(() => filtered.filter((a) => !a.activo), [filtered]);
  const graduadosAlumnos = useMemo(() => filtered.filter((a) => a.activo && a.paso_prueba), [filtered]);

  const popupData = useMemo(() => {
    if (!openPopup) return null;
    const alumno = resumen.find((a) => a.alumno_id === openPopup.alumnoId);
    if (!alumno) return null;
    const pago = alumno.pagos.find((p) => p.mes === openPopup.mes);
    return {
      estado: (pago?.estado ?? null) as PagoEstado,
      monto_pagado: pago?.monto_pagado ?? null,
      mesLabel: t(`meses.${openPopup.mes}` as Parameters<typeof t>[0]),
      alumnoNombre: `${alumno.nombre} ${alumno.apellido}`,
      buttonRef: getButtonRef(openPopup.alumnoId, openPopup.mes),
    };
  }, [openPopup, resumen, t, getButtonRef]);

  const colPopupData = useMemo(() => {
    if (openColPopup === null) return null;
    return {
      mes: openColPopup,
      mesLabel: t(`meses.${openColPopup}` as Parameters<typeof t>[0]),
      buttonRef: getColHeaderRef(openColPopup),
      alumnosCount: resumen.filter((a) => a.activo).length,
    };
  }, [openColPopup, resumen, t, getColHeaderRef]);

  const handleCellClick = (alumnoId: string, mes: number) => {
    setOpenColPopup(null);
    setOpenPopup((prev) =>
      prev?.alumnoId === alumnoId && prev?.mes === mes ? null : { alumnoId, mes }
    );
  };

  const handleColHeaderClick = (mes: number) => {
    setOpenPopup(null);
    setOpenColPopup((prev) => (prev === mes ? null : mes));
  };

  const handlePopupSave = (estado: 'pagado' | 'pendiente', monto?: number) => {
    if (!openPopup) return;
    savePago({ alumno_id: openPopup.alumnoId, año, mes: openPopup.mes, estado, monto_pagado: monto });
    setOpenPopup(null);
  };

  if (isError) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-error)]">{t('error_cargar')}</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">
          {t('anual_titulo', { año })}
        </p>
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('buscar_placeholder')}
            className={cn(
              'h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))]',
              'pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
              'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]'
            )}
          />
        </div>
      </div>

      {/* Legend */}
      <LegendSection t={t} />

      {/* Grid */}
      {isLoading ? (
        <GridSkeleton />
      ) : resumen.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
          {t('anual_sin_datos')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="sticky left-0 z-10 bg-[var(--color-bg-secondary)] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Alumno
                </th>
                {MESES.map((m) => {
                  const ref = getColHeaderRef(m);
                  const isColOpen = openColPopup === m;
                  return (
                    <th key={m} className="px-0.5 py-0">
                      <Tooltip content={t('col_header_hint')} position="top">
                        <button
                          ref={(el) => { ref.current = el; }}
                          onClick={() => handleColHeaderClick(m)}
                          className={cn(
                            'w-full rounded px-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                            'text-[var(--color-text-muted)] hover:text-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)]',
                            isColOpen && 'text-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] ring-1 ring-[var(--color-brand-gold)]'
                          )}
                        >
                          {t(`meses.${m}` as Parameters<typeof t>[0])}
                        </button>
                      </Tooltip>
                    </th>
                  );
                })}
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {activeAlumnos.map((alumno) => (
                <AlumnoRow
                  key={alumno.alumno_id}
                  alumno={alumno}
                  t={t}
                  openPopup={openPopup}
                  onCellClick={handleCellClick}
                  getButtonRef={getButtonRef}
                />
              ))}
            </tbody>
          </table>

          {graduadosAlumnos.length > 0 && (
            <div className="border-t border-[var(--color-border)]">
              <button
                onClick={() => setShowGraduados((v) => !v)}
                className="flex w-full items-center gap-2 bg-[var(--color-bg-secondary)] px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                🎓 {t('alumnos_graduados')} ({graduadosAlumnos.length})
              </button>
              {showGraduados && (
                <table className="w-full min-w-[640px] text-sm opacity-75">
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {graduadosAlumnos.map((alumno) => (
                      <AlumnoRow
                        key={alumno.alumno_id}
                        alumno={alumno}
                        t={t}
                        openPopup={openPopup}
                        onCellClick={handleCellClick}
                        getButtonRef={getButtonRef}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {inactiveAlumnos.length > 0 && (
            <div className="border-t border-[var(--color-border)]">
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="flex w-full items-center gap-2 bg-[var(--color-bg-secondary)] px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                {t('alumnos_inactivos')} ({inactiveAlumnos.length})
              </button>
              {showInactive && (
                <table className="w-full min-w-[640px] text-sm opacity-70">
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {inactiveAlumnos.map((alumno) => (
                      <AlumnoRow
                        key={alumno.alumno_id}
                        alumno={alumno}
                        t={t}
                        openPopup={openPopup}
                        onCellClick={handleCellClick}
                        getButtonRef={getButtonRef}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Popup — fixed positioned, animated */}
      <AnimatePresence>
        {openPopup && popupData && (
          <PagoPopup
            anchorRef={popupData.buttonRef as React.RefObject<HTMLElement | null>}
            estado={popupData.estado}
            monto_pagado={popupData.monto_pagado}
            alumnoNombre={popupData.alumnoNombre}
            mesLabel={popupData.mesLabel}
            onSave={handlePopupSave}
            onClose={() => setOpenPopup(null)}
          />
        )}
        {openColPopup !== null && colPopupData && (
          <PagoPopup
            key={`col-${openColPopup}`}
            anchorRef={colPopupData.buttonRef as React.RefObject<HTMLElement | null>}
            estado={null}
            monto_pagado={null}
            alumnoNombre=""
            mesLabel={colPopupData.mesLabel}
            columnMode={{ alumnosCount: colPopupData.alumnosCount }}
            onSave={(estado, monto) => {
              saveColumna({ año, mes: openColPopup, estado, monto_pagado: monto });
              setOpenColPopup(null);
            }}
            onClose={() => setOpenColPopup(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
