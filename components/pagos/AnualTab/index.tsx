'use client';

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

type EstadoCell = 'pagado' | 'parcial' | null;

const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface OpenPopup {
  alumnoId: string;
  mes: number;
}

// ── Clickable cell ────────────────────────────────────────────────────────────

interface CellButtonProps {
  estado: EstadoCell;
  monto: number | null;
  mesLabel: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
}

function CellButton({ estado, monto, mesLabel, onClick, buttonRef, isOpen }: CellButtonProps) {
  const isPaid = estado === 'pagado';
  const isPartial = estado === 'parcial';

  const title = isPaid
    ? `${mesLabel}: Pagado${monto ? ` · $${monto.toLocaleString('es-CL')}` : ''}`
    : isPartial
    ? `${mesLabel}: Parcial${monto ? ` · $${monto.toLocaleString('es-CL')}` : ''}`
    : `${mesLabel}: Sin pago`;

  return (
    <Tooltip content={title} position="top">
      <button
        ref={buttonRef as React.RefObject<HTMLButtonElement>}
        onClick={onClick}
        aria-label={title}
        aria-expanded={isOpen}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold',
          'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
          'hover:scale-110 active:scale-95',
          isPaid && 'bg-[var(--color-success)] text-white shadow-sm',
          isPartial && 'bg-orange-400 text-white shadow-sm dark:bg-orange-500',
          !estado && cn(
            'border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-transparent',
            'hover:border-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)] hover:text-[var(--color-brand-gold)]'
          ),
          isOpen && 'ring-2 ring-[var(--color-brand-gold)] ring-offset-1'
        )}
      >
        {isPaid ? '✓' : isPartial ? '½' : '+'}
      </button>
    </Tooltip>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AnualTabProps {
  año: number;
}

export function AnualTab({ año }: AnualTabProps) {
  const t = useTranslations('pagos');
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [openPopup, setOpenPopup] = useState<OpenPopup | null>(null);
  const [openColPopup, setOpenColPopup] = useState<number | null>(null); // stores mes

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
      // Invalidate TrackingTab + StatsTab cache for the affected month
      queryClient.invalidateQueries({ queryKey: ['admin-pagos', año, vars.mes] });
    },
  });

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase();
    return resumen.filter((a) => !q || `${a.nombre} ${a.apellido}`.toLowerCase().includes(q));
  }, [resumen, searchText]);

  const activeAlumnos = useMemo(() => filtered.filter((a) => a.activo), [filtered]);
  const inactiveAlumnos = useMemo(() => filtered.filter((a) => !a.activo), [filtered]);

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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('buscar_placeholder')}
            className={cn(
              'h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]',
              'pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
              'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]'
            )}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-success)] text-[9px] font-bold text-white">✓</div>
          <span>{t('anual_leyenda_pagado')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-400 text-[9px] font-bold text-white">½</div>
          <span>{t('anual_leyenda_parcial')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]" />
          <span>{t('anual_leyenda_pendiente')}</span>
        </div>
      </div>

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

// ── Row sub-component ────────────────────────────────────────────────────────

function AlumnoRow({
  alumno,
  t,
  openPopup,
  onCellClick,
  getButtonRef,
}: {
  alumno: AlumnoResumenAnual;
  t: ReturnType<typeof useTranslations<'pagos'>>;
  openPopup: OpenPopup | null;
  onCellClick: (alumnoId: string, mes: number) => void;
  getButtonRef: (alumnoId: string, mes: number) => React.RefObject<HTMLButtonElement | null>;
}) {
  const pagadosMeses = alumno.pagos.filter((p) => p.estado === 'pagado' || p.estado === 'parcial').length;
  const tasaMes = Math.round((pagadosMeses / 12) * 100);

  return (
    <tr className="group hover:bg-[var(--color-bg-secondary)] transition-colors">
      <td className="sticky left-0 z-10 bg-[var(--color-bg)] px-3 py-2 group-hover:bg-[var(--color-bg-secondary)] transition-colors">
        <span className="whitespace-nowrap text-sm font-medium text-[var(--color-text-primary)]">
          {alumno.nombre} {alumno.apellido}
        </span>
      </td>
      {alumno.pagos.map((pago) => {
        const ref = getButtonRef(alumno.alumno_id, pago.mes);
        const isOpen = openPopup?.alumnoId === alumno.alumno_id && openPopup?.mes === pago.mes;
        return (
          <td key={pago.mes} className="px-1 py-2">
            <div className="flex justify-center">
              <CellButton
                estado={pago.estado as EstadoCell}
                monto={pago.monto_pagado}
                mesLabel={t(`meses.${pago.mes}` as Parameters<typeof t>[0])}
                buttonRef={ref}
                isOpen={isOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  (ref as React.MutableRefObject<HTMLButtonElement | null>).current = e.currentTarget;
                  onCellClick(alumno.alumno_id, pago.mes);
                }}
              />
            </div>
          </td>
        );
      })}
      <td className="px-3 py-2 text-center">
        <span
          className={cn(
            'text-xs font-semibold',
            tasaMes >= 80 ? 'text-[var(--color-success)]' : tasaMes >= 50 ? 'text-orange-500' : 'text-[var(--color-text-muted)]'
          )}
        >
          {tasaMes}%
        </span>
      </td>
    </tr>
  );
}

function GridSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2.5">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="flex flex-1 gap-1 justify-around">
            {Array.from({ length: 12 }).map((_, j) => (
              <div key={j} className="h-8 w-8 animate-pulse rounded-full bg-[var(--color-bg-secondary)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

