'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, type Locale } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/common/Avatar';
import { Tooltip } from '@/components/common/Tooltip';
import { useTranslations, useLocale } from 'next-intl';

export type AlumnoPago = {
  alumno_id: string;
  nombre: string;
  apellido: string;
  avatar_url: string | null;
  activo: boolean;
  profesor: { id: string; nombre: string; apellido: string } | null;
  pago: {
    id: string;
    estado: 'pagado' | 'parcial';
    monto_pagado: number | null;
    fecha_pago: string;
  } | null;
};

type ProfesorOption = { id: string; nombre: string; apellido: string };
type FiltroEstado = 'todos' | 'pagados' | 'pendientes' | 'parcial';

function formatCLP(amount: number): string {
  return `$${amount.toLocaleString('es-CL')}`;
}

function formatFechaPago(isoDate: string, locale: Locale): string {
  return format(new Date(isoDate), 'd MMM', { locale });
}

// ── Single student card ──────────────────────────────────────────────────────

interface StudentCardProps {
  alumno: AlumnoPago;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onMark: (alumnoId: string, estado: 'pagado' | 'parcial' | 'pendiente', monto?: number) => void;
  t: ReturnType<typeof useTranslations<'pagos'>>;
  dateLocale: Locale;
}

function StudentCard({ alumno, isExpanded, onToggleExpand, onMark, t, dateLocale }: StudentCardProps) {
  const [montoInput, setMontoInput] = useState(
    alumno.pago?.monto_pagado ? String(alumno.pago.monto_pagado) : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const isPaid = alumno.pago?.estado === 'pagado';
  const isPartial = alumno.pago?.estado === 'parcial';
  const isPending = !alumno.pago;

  const handleExpandPartial = useCallback(() => {
    onToggleExpand(alumno.alumno_id);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [alumno.alumno_id, onToggleExpand]);

  const handleSavePartial = () => {
    const monto = parseInt(montoInput.replace(/\D/g, ''), 10);
    if (isNaN(monto) || monto <= 0) {
      onMark(alumno.alumno_id, 'parcial', undefined);
    } else {
      onMark(alumno.alumno_id, 'parcial', monto);
    }
    onToggleExpand(alumno.alumno_id);
  };

  const borderColor = isPaid
    ? 'border-l-4 border-l-[var(--color-success)]'
    : isPartial
    ? 'border-l-4 border-l-[var(--color-warning)]'
    : 'border-l-4 border-l-[var(--color-border)]';

  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)] overflow-hidden transition-all',
        borderColor
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        {/* Avatar */}
        <div className="shrink-0">
          <Avatar
            avatarUrl={alumno.avatar_url}
            nombre={alumno.nombre}
            apellido={alumno.apellido}
            size="sm"
          />
        </div>

        {/* Name + profesor */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {alumno.nombre} {alumno.apellido}
          </p>
          {alumno.profesor && (
            <p className="text-xs text-[var(--color-text-muted)] truncate">
              {alumno.profesor.nombre} {alumno.profesor.apellido}
            </p>
          )}
          {/* Status info line */}
          {isPaid && alumno.pago && (
            <p className="text-xs text-[var(--color-success)] mt-0.5">
              {t('fecha_pago', { fecha: formatFechaPago(alumno.pago.fecha_pago, dateLocale) })}
            </p>
          )}
          {isPartial && alumno.pago && (
            <p className="text-xs text-[var(--color-warning)] mt-0.5">
              {alumno.pago.monto_pagado ? formatCLP(alumno.pago.monto_pagado) : t('estado_parcial')}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isPending && (
            <>
              {/* Mark paid — primary action */}
              <Tooltip content={t('marcar_pagado')}>
                <button
                  onClick={() => onMark(alumno.alumno_id, 'pagado')}
                  className={cn(
                    'flex size-10 items-center justify-center rounded-[var(--radius-md)] transition-colors',
                    'bg-green-50 text-[var(--color-success)] hover:bg-green-100',
                    'dark:bg-green-950/30 dark:hover:bg-green-950/50'
                  )}
                  aria-label={t('marcar_pagado')}
                >
                  <Check className="size-5" />
                </button>
              </Tooltip>
              {/* Mark partial */}
              <Tooltip content={t('marcar_parcial_tooltip')}>
                <button
                  onClick={handleExpandPartial}
                  className={cn(
                    'flex h-10 items-center gap-1 rounded-[var(--radius-md)] px-2.5 text-xs font-medium transition-colors',
                    'bg-[var(--color-partial-muted)] text-[var(--color-partial)] hover:opacity-80'
                  )}
                  aria-label={t('marcar_parcial_tooltip')}
                >
                  {t('marcar_parcial')}
                </button>
              </Tooltip>
            </>
          )}

          {(isPaid || isPartial) && (
            <>
              {/* Status badge */}
              <span
                className={cn(
                  'inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 text-xs font-semibold',
                  isPaid
                    ? 'bg-green-50 text-[var(--color-success)] dark:bg-green-950/30'
                    : 'bg-[var(--color-partial-muted)] text-[var(--color-partial)]'
                )}
              >
                {isPaid ? <Check className="size-3.5" /> : null}
                {isPaid ? t('estado_pagado') : t('estado_parcial')}
              </span>

              {/* Edit partial amount */}
              {isPartial && (
                <button
                  onClick={handleExpandPartial}
                  className="flex size-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                  aria-label="Editar monto"
                >
                  {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
              )}

              {/* Unmark */}
              <Tooltip content={t('desmarcar')}>
                <button
                  onClick={() => onMark(alumno.alumno_id, 'pendiente')}
                  className="flex size-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-red-50 hover:text-[var(--color-error)] dark:hover:bg-red-950/30 transition-colors"
                  aria-label={t('desmarcar')}
                >
                  <X className="size-4" />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* Expanded partial amount form */}
      {isExpanded && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 pb-3 pt-2.5">
          <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
            {t('monto_label')}
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min="1"
              value={montoInput}
              onChange={(e) => setMontoInput(e.target.value)}
              placeholder={t('monto_placeholder')}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePartial(); }}
              className={cn(
                'h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]',
                'px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
                'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]'
              )}
            />
            <button
              onClick={handleSavePartial}
              className="h-10 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 text-sm font-medium text-white hover:bg-[var(--color-brand-gold-light)] transition-colors"
            >
              {t('guardar_monto')}
            </button>
            <button
              onClick={() => onToggleExpand(alumno.alumno_id)}
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] transition-colors"
            >
              {t('cancelar_monto')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main TrackingTab ────────────────────────────────────────────────────────

interface TrackingTabProps {
  año: number;
  mes: number;
}

export function TrackingTab({ año, mes }: TrackingTabProps) {
  const t = useTranslations('pagos');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? enUS : es;
  const queryClient = useQueryClient();

  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
  const [searchText, setSearchText] = useState('');
  const [profesorFilter, setProfesorFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const queryKey = ['admin-pagos', año, mes] as const;

  const { data: alumnos = [], isLoading, isError } = useQuery<AlumnoPago[]>({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/admin/pagos?año=${año}&mes=${mes}`);
      if (!r.ok) throw new Error('Error fetching pagos');
      return r.json();
    },
    staleTime: 30_000,
  });

  // Mutation with optimistic update
  const mutation = useMutation({
    mutationFn: async ({
      alumnoId,
      estado,
      monto,
    }: {
      alumnoId: string;
      estado: 'pagado' | 'parcial' | 'pendiente';
      monto?: number;
    }) => {
      const r = await fetch('/api/admin/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumno_id: alumnoId,
          año,
          mes,
          estado,
          monto_pagado: estado === 'parcial' ? (monto ?? null) : null,
        }),
      });
      if (!r.ok) throw new Error('Error');
      return r.json();
    },
    onMutate: async ({ alumnoId, estado, monto }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<AlumnoPago[]>(queryKey);
      queryClient.setQueryData<AlumnoPago[]>(queryKey, (old = []) =>
        old.map((a) =>
          a.alumno_id === alumnoId
            ? {
                ...a,
                pago:
                  estado === 'pendiente'
                    ? null
                    : {
                        id: a.pago?.id ?? 'optimistic',
                        estado: estado as 'pagado' | 'parcial',
                        monto_pagado: estado === 'parcial' ? (monto ?? null) : null,
                        fecha_pago: new Date().toISOString(),
                      },
              }
            : a
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error(t('error_marcar'));
    },
    onSuccess: (_data, { estado }) => {
      toast.success(estado === 'pendiente' ? t('exito_desmarcado') : t('exito_marcado'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pagos', año, mes] });
      queryClient.invalidateQueries({ queryKey: ['admin-pagos-anual', año] });
    },
  });

  const handleMark = useCallback(
    (alumnoId: string, estado: 'pagado' | 'parcial' | 'pendiente', monto?: number) => {
      mutation.mutate({ alumnoId, estado, monto });
      setExpandedId(null);
    },
    [mutation]
  );

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Derive profesores list for filter dropdown
  const profesores = useMemo<ProfesorOption[]>(() => {
    const seen = new Map<string, ProfesorOption>();
    for (const a of alumnos) {
      if (a.profesor && !seen.has(a.profesor.id)) seen.set(a.profesor.id, a.profesor);
    }
    return [...seen.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [alumnos]);

  // Summary counts (active students only)
  const summary = useMemo(() => {
    const active = alumnos.filter((a) => a.activo);
    const pagados = active.filter((a) => a.pago?.estado === 'pagado').length;
    const parciales = active.filter((a) => a.pago?.estado === 'parcial').length;
    const pendientes = active.filter((a) => !a.pago).length;
    const totalRecaudado = active.reduce((acc, a) => {
      if (a.pago?.estado === 'pagado') return acc; // unknown full amount
      if (a.pago?.estado === 'parcial' && a.pago.monto_pagado) return acc + a.pago.monto_pagado;
      return acc;
    }, 0);
    return { pagados, parciales, pendientes, totalRecaudado };
  }, [alumnos]);

  // Filtered lists
  const filterAlumno = useCallback(
    (a: AlumnoPago) => {
      const q = searchText.toLowerCase();
      if (q && !`${a.nombre} ${a.apellido}`.toLowerCase().includes(q)) return false;
      if (profesorFilter && a.profesor?.id !== profesorFilter) return false;
      if (filtro === 'pagados' && a.pago?.estado !== 'pagado') return false;
      if (filtro === 'pendientes' && a.pago) return false;
      if (filtro === 'parcial' && a.pago?.estado !== 'parcial') return false;
      return true;
    },
    [searchText, profesorFilter, filtro]
  );

  const activeFiltered = useMemo(
    () => alumnos.filter((a) => a.activo).filter(filterAlumno),
    [alumnos, filterAlumno]
  );

  const inactiveFiltered = useMemo(
    () => alumnos.filter((a) => !a.activo).filter(filterAlumno),
    [alumnos, filterAlumno]
  );

  const FILTROS: { key: FiltroEstado; label: string }[] = [
    { key: 'todos', label: t('filtro_todos') },
    { key: 'pagados', label: t('filtro_pagados') },
    { key: 'pendientes', label: t('filtro_pendientes') },
    { key: 'parcial', label: t('filtro_parcial') },
  ];

  if (isError) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-error)]">{t('error_cargar')}</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
        <SummaryChip
          label={t('resumen_pagados')}
          value={summary.pagados}
          color="success"
          loading={isLoading}
        />
        <SummaryChip
          label={t('resumen_pendientes')}
          value={summary.pendientes}
          color="warning"
          loading={isLoading}
        />
        <SummaryChip
          label={t('resumen_parcial')}
          value={summary.parciales}
          color="partial"
          loading={isLoading}
        />
      </div>

      {/* Search + filters */}
      <div className="space-y-2">
        {/* Search row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
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
          {profesores.length > 0 && (
            <select
              value={profesorFilter}
              onChange={(e) => setProfesorFilter(e.target.value)}
              className={cn(
                'h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]',
                'px-3 text-sm text-[var(--color-text-primary)]',
                'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]'
              )}
            >
              <option value="">{t('todos_profesores')}</option>
              {profesores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.apellido}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={cn(
                'h-9 rounded-full px-3.5 text-xs font-medium transition-colors',
                filtro === f.key
                  ? 'bg-[var(--color-brand-gold)] text-white'
                  : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active students */}
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {t('alumnos_activos')} ({activeFiltered.length})
        </p>
        {isLoading ? (
          <SkeletonList />
        ) : activeFiltered.length === 0 ? (
          <EmptyState label={filtro !== 'todos' ? t('sin_resultados') : t('sin_activos')} />
        ) : (
          <div className="space-y-2">
            {activeFiltered.map((a) => (
              <StudentCard
                key={a.alumno_id}
                alumno={a}
                isExpanded={expandedId === a.alumno_id}
                onToggleExpand={handleToggleExpand}
                onMark={handleMark}
                t={t}
                dateLocale={dateLocale as Locale}
              />
            ))}
          </div>
        )}
      </section>

      {/* Inactive students (collapsible) */}
      {(inactiveFiltered.length > 0 || alumnos.some((a) => !a.activo)) && (
        <section>
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            {showInactive ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {t('alumnos_inactivos')} ({inactiveFiltered.length})
          </button>
          {showInactive && (
            <div className="mt-2 space-y-2 opacity-75">
              {inactiveFiltered.length === 0 ? (
                <EmptyState label={t('sin_inactivos')} />
              ) : (
                inactiveFiltered.map((a) => (
                  <StudentCard
                    key={a.alumno_id}
                    alumno={a}
                    isExpanded={expandedId === a.alumno_id}
                    onToggleExpand={handleToggleExpand}
                    onMark={handleMark}
                    t={t}
                    dateLocale={dateLocale as Locale}
                  />
                ))
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Helper components ────────────────────────────────────────────────────────

function SummaryChip({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: number;
  color: 'success' | 'warning' | 'partial';
  loading: boolean;
}) {
  const colorCls = {
    success: 'text-[var(--color-success)] bg-[var(--color-success)]/10',
    warning: 'text-[var(--color-partial)] bg-[var(--color-partial-muted)]',
    partial: 'text-[var(--color-partial)] bg-[var(--color-partial-muted)]',
  }[color];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-md)] px-2 py-2.5 text-center',
        colorCls
      )}
    >
      {loading ? (
        <div className="h-6 w-8 animate-pulse rounded bg-current opacity-20" />
      ) : (
        <span className="text-xl font-bold leading-none">{value}</span>
      )}
      <span className="mt-1 text-[10px] font-medium leading-none opacity-80">{label}</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] py-8 text-sm text-[var(--color-text-muted)]">
      <CreditCard className="size-4" />
      {label}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
        />
      ))}
    </div>
  );
}
