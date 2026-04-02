'use client';

import { Suspense, useState, useMemo, useRef } from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { es, enUS, type Locale } from 'date-fns/locale';
import {
  Calendar, Clock, User, ArrowLeft, CheckCircle, XCircle, ArrowRight,
  CalendarOff, Search, X, SlidersHorizontal, BookOpen, History,
  ChevronDown, FileText, GraduationCap,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { NotasIndicator } from '@/components/notas/NotasIndicator';
import { ConfirmacionForm } from '@/components/horarios/ConfirmacionForm';
import { CancelacionForm } from '@/components/horarios/CancelacionForm';
import { CambioHorarioForm } from '@/components/horarios/CambioHorarioForm';
import { NotasSection } from '@/components/notas/NotasSection';
import { Tooltip } from '@/components/common/Tooltip';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAsistencia } from '@/lib/hooks/useAsistencia';
import { useNotasCount } from '@/lib/hooks/useNotasCount';
import { useClaseTimeStatus } from '@/lib/hooks/useServerTime';
import { useQueryParam } from '@/lib/hooks/useQueryParam';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { usePruebas } from '@/lib/hooks/usePruebas';
import { buildAlumnoHorarioDetailHref, getAlumnoHorarioBackHref } from '@/lib/utils/horarioNavigation';
import { useUserStore } from '@/stores/useUserStore';
import type { ClaseAlumno } from '@/lib/hooks/useAsistencia';
import type { EstadoAsistencia } from '@/lib/supabase/types';
import { useTranslations, useLocale } from 'next-intl';

/* ── Search input ── */
function SearchInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-9 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)] transition-shadow"
      />
      {value && (
        <button
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Day label badge ── */
function DayBadge({ fecha, t }: { fecha: string; t: ReturnType<typeof useTranslations> }) {
  const d = new Date(fecha + 'T12:00:00');
  if (isToday(d)) return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-brand-gold)] px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide">
      {t('hoy_badge')}
    </span>
  );
  if (isTomorrow(d)) return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand-gold)] uppercase tracking-wide border border-[var(--color-brand-gold)]/40">
      {t('proxima_badge')}
    </span>
  );
  return null;
}

/* ── Single upcoming class card ── */
function UpcomingClaseCard({ clase, locale, dateFnsLocale, t, isFirst, isExamen }: {
  clase: ClaseAlumno;
  locale: string;
  dateFnsLocale: Locale;
  t: ReturnType<typeof useTranslations>;
  isFirst: boolean;
  isExamen?: boolean;
}) {
  return (
    <Link href={buildAlumnoHorarioDetailHref(clase.horario.id, '/alumno/horario')} className="block group">
      <div className={`relative rounded-[var(--radius-lg)] border bg-[var(--color-bg)] shadow-[var(--shadow-sm)] overflow-hidden transition-all group-hover:shadow-[var(--shadow-md)] group-hover:-translate-y-0.5 ${
        isFirst
          ? 'border-[var(--color-brand-gold)]/50 shadow-[var(--shadow-gold)]'
          : 'border-[var(--color-border)]'
      }`}>
        {/* Gold accent bar for next class */}
        {isFirst && (
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-lg)] bg-[var(--color-brand-gold)]" />
        )}
        <div className={`p-4 ${isFirst ? 'pl-5' : ''}`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <p className="font-semibold text-[var(--color-text-primary)] truncate">{clase.horario.titulo}</p>
              <DayBadge fecha={clase.horario.fecha} t={t} />
              {isExamen && (
                <span className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                  <GraduationCap className="h-2.5 w-2.5" />
                  {t('badge_examen')}
                </span>
              )}
            </div>
            <StatusBadge status={clase.estado} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 py-1">
              <Calendar className="h-3.5 w-3.5 text-[var(--color-brand-gold)] flex-shrink-0" />
              <span className="capitalize">
                {format(new Date(clase.horario.fecha + 'T12:00:00'), locale === 'en' ? "EEE, MMM d" : "EEE d 'de' MMM", { locale: dateFnsLocale })}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 py-1">
              <Clock className="h-3.5 w-3.5 text-[var(--color-brand-gold)] flex-shrink-0" />
              {clase.horario.hora_inicio} – {clase.horario.hora_fin}
            </span>
            {clase.horario.profesor && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 py-1">
                <User className="h-3.5 w-3.5 text-[var(--color-brand-gold)] flex-shrink-0" />
                Prof. {clase.horario.profesor.nombre} {clase.horario.profesor.apellido}
              </span>
            )}
          </div>
          {clase.horario.descripcion && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)] line-clamp-1">{clase.horario.descripcion}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ── Single history class card ── */
function HistorialClaseCard({ clase, locale, dateFnsLocale, notasCount, isExamen }: {
  clase: ClaseAlumno;
  locale: string;
  dateFnsLocale: Locale;
  notasCount: number;
  isExamen?: boolean;
}) {
  const t = useTranslations('horarios');
  return (
    <Link href={buildAlumnoHorarioDetailHref(clase.horario.id, '/alumno/horario')} className="block group">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)] overflow-hidden transition-all group-hover:shadow-[var(--shadow-md)] group-hover:border-[var(--color-border-strong)]">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-medium text-[var(--color-text-primary)] truncate text-sm">{clase.horario.titulo}</p>
              {isExamen && (
                <span className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold shrink-0"
                  style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                  <GraduationCap className="h-2.5 w-2.5" />
                  {t('badge_examen')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {notasCount > 0 && <NotasIndicator count={notasCount} />}
              <StatusBadge status={clase.estado} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5">
              <Calendar className="h-3 w-3 text-[var(--color-brand-gold)] flex-shrink-0" />
              <span className="capitalize">
                {format(new Date(clase.horario.fecha + 'T12:00:00'), locale === 'en' ? "MMM d, yyyy" : "d 'de' MMM yyyy", { locale: dateFnsLocale })}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5">
              <Clock className="h-3 w-3 text-[var(--color-brand-gold)] flex-shrink-0" />
              {clase.horario.hora_inicio}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Skeleton loader ── */
function SkeletonCard() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-4 w-44 rounded bg-[var(--color-bg-elevated)]" />
        <div className="h-5 w-20 rounded-full bg-[var(--color-bg-elevated)]" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-28 rounded-full bg-[var(--color-bg-elevated)]" />
        <div className="h-6 w-20 rounded-full bg-[var(--color-bg-elevated)]" />
      </div>
    </div>
  );
}

/* ── Tab button ── */
function TabButton({
  active, onClick, children, count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-[var(--radius-md)] focus:outline-none ${
        active
          ? 'text-[var(--color-text-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[var(--color-brand-gold)] after:rounded-full'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold transition-colors ${
          active
            ? 'bg-[var(--color-brand-gold)] text-white'
            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

type ActiveTab = 'proximas' | 'historial';
type HistorialFilter = EstadoAsistencia | 'todos';

/* ── List view (no ?id= param) ── */
function HorarioListView({ clases, loading }: { clases: ClaseAlumno[]; loading: boolean }) {
  const t = useTranslations('horarios');
  const te = useTranslations('asistencia.estados');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const today = new Date().toISOString().split('T')[0];
  const { user } = useUserStore();

  /* Fetch pruebas to detect exam classes */
  const { data: pruebas = [] } = usePruebas(user?.id);

  /* Tabs */
  const [activeTab, setActiveTab] = useState<ActiveTab>('proximas');

  /* Search state (raw) */
  const [searchProximas, setSearchProximas] = useState('');
  const [searchHistorial, setSearchHistorial] = useState('');

  /* Historial filters */
  const [historialFilter, setHistorialFilter] = useState<HistorialFilter>('todos');
  const [soloConNotas, setSoloConNotas] = useState(false);
  const [soloPruebas, setSoloPruebas] = useState(false);

  /* Debounced search */
  const debouncedProximas = useDebounce(searchProximas, 280);
  const debouncedHistorial = useDebounce(searchHistorial, 280);

  const upcoming = useMemo(
    () => clases
      .filter((c) => c.horario.fecha >= today && c.horario.activo)
      .sort((a, b) => a.horario.fecha.localeCompare(b.horario.fecha) || a.horario.hora_inicio.localeCompare(b.horario.hora_inicio)),
    [clases, today]
  );

  const past = useMemo(
    () => clases
      .filter((c) => c.horario.fecha < today)
      .sort((a, b) => b.horario.fecha.localeCompare(a.horario.fecha)),
    [clases, today]
  );

  /* Note counts — needed before filteredHistorial for soloConNotas filter */
  const notableIds = useMemo(
    () => past.filter((c) => c.estado === 'confirmado' || c.estado === 'no_asistio').map((c) => c.horario.id),
    [past]
  );
  const notasCounts = useNotasCount(notableIds);

  /* Set of horario IDs that have an associated prueba (exam) */
  const pruebaHorarioIds = useMemo(
    () => new Set(pruebas.filter((p) => p.horario_id).map((p) => p.horario_id!)),
    [pruebas]
  );

  /* Filtered upcoming */
  const filteredUpcoming = useMemo(() => {
    if (!debouncedProximas.trim()) return upcoming;
    const q = debouncedProximas.toLowerCase();
    return upcoming.filter((c) =>
      c.horario.titulo.toLowerCase().includes(q) ||
      c.horario.descripcion?.toLowerCase().includes(q) ||
      (c.horario.profesor &&
        `${c.horario.profesor.nombre} ${c.horario.profesor.apellido}`.toLowerCase().includes(q))
    );
  }, [upcoming, debouncedProximas]);

  /* Filtered historial — applies estado filter, notas filter, prueba filter, then search */
  const filteredHistorial = useMemo(() => {
    let base = past;
    if (historialFilter !== 'todos') {
      base = base.filter((c) => c.estado === historialFilter);
    }
    if (soloConNotas) {
      base = base.filter((c) => (notasCounts[c.horario.id] ?? 0) > 0);
    }
    if (soloPruebas) {
      base = base.filter((c) => pruebaHorarioIds.has(c.horario.id));
    }
    if (!debouncedHistorial.trim()) return base;
    const q = debouncedHistorial.toLowerCase();
    return base.filter((c) =>
      c.horario.titulo.toLowerCase().includes(q) ||
      c.horario.descripcion?.toLowerCase().includes(q) ||
      (c.horario.profesor &&
        `${c.horario.profesor.nombre} ${c.horario.profesor.apellido}`.toLowerCase().includes(q))
    );
  }, [past, historialFilter, soloConNotas, soloPruebas, notasCounts, pruebaHorarioIds, debouncedHistorial]);

  /* Historial status options (only statuses that exist in past) */
  const historialStatuses = useMemo(() => {
    const seen = new Set<EstadoAsistencia>();
    past.forEach((c) => seen.add(c.estado));
    return Array.from(seen);
  }, [past]);

  if (loading) {
    return (
      <div className="mt-[var(--space-lg)] space-y-3">
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="mt-[var(--space-lg)]">
      {/* Tab bar */}
      <div className="border-b border-[var(--color-border)] mb-5">
        <div className="flex gap-1">
          <TabButton
            active={activeTab === 'proximas'}
            onClick={() => setActiveTab('proximas')}
            count={upcoming.length}
          >
            <BookOpen className="h-4 w-4" />
            {t('tab_proximas')}
          </TabButton>
          <TabButton
            active={activeTab === 'historial'}
            onClick={() => setActiveTab('historial')}
            count={past.length}
          >
            <History className="h-4 w-4" />
            {t('tab_historial')}
          </TabButton>
        </div>
      </div>

      {/* ── Tab: Próximas ── */}
      {activeTab === 'proximas' && (
        <div className="space-y-4">
          <SearchInput
            id="search-proximas"
            value={searchProximas}
            onChange={setSearchProximas}
            placeholder={t('buscar_proximas')}
          />

          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-16 px-4 text-center">
              <CalendarOff className="h-12 w-12 text-[var(--color-text-muted)] mb-4" />
              <p className="font-semibold text-[var(--color-text-primary)] mb-1">{t('sin_proximas')}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{t('sin_proximas_subtitulo')}</p>
            </div>
          ) : filteredUpcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-12 px-4 text-center">
              <Search className="h-8 w-8 text-[var(--color-text-muted)] mb-3" />
              <p className="text-sm text-[var(--color-text-muted)]">{t('sin_resultados_busqueda', { query: debouncedProximas })}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUpcoming.map((clase, idx) => (
                <UpcomingClaseCard
                  key={clase.id}
                  clase={clase}
                  locale={locale}
                  dateFnsLocale={dateFnsLocale}
                  t={t}
                  isFirst={idx === 0 && !debouncedProximas.trim()}
                  isExamen={pruebaHorarioIds.has(clase.horario.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Historial ── */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          {/* Search + filter row */}
          <div className="flex flex-col gap-2">
            <SearchInput
              id="search-historial"
              value={searchHistorial}
              onChange={setSearchHistorial}
              placeholder={t('buscar_historial')}
            />
            {/* Filter chips row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Estado dropdown */}
              {historialStatuses.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)] cursor-pointer ${
                      historialFilter !== 'todos'
                        ? 'bg-[var(--color-brand-gold-muted)] border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                        : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {historialFilter === 'todos' ? t('todos_estados_historial') : te(historialFilter)}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="bottom" className="min-w-[180px]">
                    <DropdownMenuRadioGroup
                      value={historialFilter}
                      onValueChange={(v) => setHistorialFilter(v as HistorialFilter)}
                    >
                      <DropdownMenuRadioItem value="todos">
                        {t('todos_estados_historial')}
                      </DropdownMenuRadioItem>
                      <DropdownMenuSeparator />
                      {historialStatuses.map((s) => (
                        <DropdownMenuRadioItem key={s} value={s}>
                          {te(s)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Notas filter chip */}
              <Tooltip content={t('tooltip_filtro_notas')} position="top">
                <button
                  onClick={() => setSoloConNotas(!soloConNotas)}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] border text-sm font-medium transition-colors select-none ${
                    soloConNotas
                      ? 'bg-[var(--color-brand-gold-muted)] border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                    soloConNotas
                      ? 'bg-[var(--color-brand-gold)] border-[var(--color-brand-gold)]'
                      : 'border-[var(--color-border-strong)]'
                  }`}>
                    {soloConNotas && (
                      <svg viewBox="0 0 8 8" className="h-2.5 w-2.5 text-white fill-current"><path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                    )}
                  </span>
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  {t('filtro_con_notas')}
                </button>
              </Tooltip>

              {/* Prueba filter chip */}
              <Tooltip content={t('tooltip_filtro_pruebas')} position="top">
                <button
                  onClick={() => setSoloPruebas(!soloPruebas)}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] border text-sm font-medium transition-colors select-none ${
                    soloPruebas
                      ? 'bg-[var(--color-brand-gold-muted)] border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                    soloPruebas
                      ? 'bg-[var(--color-brand-gold)] border-[var(--color-brand-gold)]'
                      : 'border-[var(--color-border-strong)]'
                  }`}>
                    {soloPruebas && (
                      <svg viewBox="0 0 8 8" className="h-2.5 w-2.5 text-white fill-current"><path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                    )}
                  </span>
                  <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                  {t('filtro_pruebas')}
                </button>
              </Tooltip>
            </div>
          </div>

          {past.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-16 px-4 text-center">
              <History className="h-12 w-12 text-[var(--color-text-muted)] mb-4" />
              <p className="font-semibold text-[var(--color-text-primary)]">{t('sin_historial')}</p>
            </div>
          ) : filteredHistorial.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-12 px-4 text-center">
              <Search className="h-8 w-8 text-[var(--color-text-muted)] mb-3" />
              <p className="text-sm text-[var(--color-text-muted)]">
                {debouncedHistorial.trim()
                  ? t('sin_resultados_busqueda', { query: debouncedHistorial })
                  : historialFilter !== 'todos'
                    ? t('sin_historial_filtro', { estado: te(historialFilter) })
                    : t('sin_historial_filtro', { estado: soloConNotas ? t('filtro_con_notas') : t('filtro_pruebas') })}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredHistorial.map((clase) => (
                <HistorialClaseCard
                  key={clase.id}
                  clase={clase}
                  locale={locale}
                  dateFnsLocale={dateFnsLocale}
                  notasCount={notasCounts[clase.horario.id] ?? 0}
                  isExamen={pruebaHorarioIds.has(clase.horario.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Detail view (?id= present) ── */
function HorarioDetailView({ clase, user, confirmar, cancelar, pedirCambio, isExamen }: {
  clase: ClaseAlumno;
  user: { id: string } | null;
  confirmar: (id: string) => Promise<void>;
  cancelar: (id: string, nota?: string) => Promise<void>;
  pedirCambio: (id: string, nuevoId: string, nota?: string) => Promise<void>;
  isExamen?: boolean;
}) {
  const [modal, setModal] = useState<{ type: 'confirmar' | 'cancelar' | 'cambio'; clase: ClaseAlumno } | null>(null);
  const t = useTranslations('horarios');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;

  const { enCurso, yaPaso } = useClaseTimeStatus(
    clase.horario.fecha,
    clase.horario.hora_inicio,
    clase.horario.hora_fin
  );

  // Show "en_curso" badge when class is confirmed and currently happening
  const displayStatus = (clase.estado === 'confirmado' && enCurso) ? 'en_curso' : clase.estado;

  // Notes are visible for confirmed/no_asistio classes that are in progress or past
  const showNotas = (clase.estado === 'confirmado' || clase.estado === 'no_asistio') && (enCurso || yaPaso);

  // Cannot cancel if class is in progress or already happened
  const canCancel = !enCurso && !yaPaso;

  const borderColor = () => {
    if (enCurso && clase.estado === 'confirmado') return 'border-emerald-500';
    switch (clase.estado) {
      case 'pendiente': return 'border-[var(--color-brand-gold)]';
      case 'confirmado': return 'border-[var(--color-success)]';
      case 'cancelado':
      case 'cambiado': return 'border-[var(--color-error)]';
      default: return 'border-[var(--color-border)]';
    }
  };

  return (
    <>
      <div className="mt-[var(--space-lg)] space-y-[var(--space-md)]">
        <Card className={`border-2 ${borderColor()}`} padding="lg">
          <div className="space-y-4">
            {/* Exam banner */}
            {isExamen && (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5"
                style={{ backgroundColor: 'var(--color-brand-gold-muted)', border: '1px solid color-mix(in srgb, var(--color-brand-gold) 40%, transparent)' }}>
                <GraduationCap className="h-4 w-4 shrink-0" style={{ color: 'var(--color-brand-gold)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-brand-gold)' }}>{t('es_examen')}</span>
              </div>
            )}
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{clase.horario.titulo}</h2>
              <StatusBadge status={displayStatus} />
            </div>

            {clase.horario.descripcion && (
              <p className="text-[var(--color-text-muted)]">{clase.horario.descripcion}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <Calendar className="h-4 w-4 text-[var(--color-brand-gold)]" />
                <span className="capitalize">
                  {format(new Date(clase.horario.fecha + 'T12:00:00'), locale === 'en' ? "EEEE, MMMM d yyyy" : "EEEE d 'de' MMMM yyyy", { locale: dateFnsLocale })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <Clock className="h-4 w-4 text-[var(--color-brand-gold)]" />
                <span>{clase.horario.hora_inicio} - {clase.horario.hora_fin}</span>
              </div>
            </div>

            {clase.horario.profesor && (
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)]">
                  {clase.horario.profesor.avatar_url ? (
                    <img src={clase.horario.profesor.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-[var(--color-brand-gold)]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Prof. {clase.horario.profesor.nombre} {clase.horario.profesor.apellido}
                  </p>
                </div>
              </div>
            )}

            {clase.nota_alumno && (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase mb-1">{t('tu_mensaje')}</p>
                <p className="text-sm text-[var(--color-text-primary)]">{clase.nota_alumno}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Acciones */}
        <Card padding="lg">
          <h3 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3">{t('acciones')}</h3>

          {clase.estado === 'pendiente' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setModal({ type: 'confirmar', clase })}
                className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-success)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 min-h-[48px]"
              >
                <CheckCircle className="h-5 w-5" />
                {t('confirmar_asistencia')}
              </button>
              <button
                onClick={() => setModal({ type: 'cancelar', clase })}
                className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-error)] px-4 py-3 text-sm font-medium text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20 min-h-[48px]"
              >
                <XCircle className="h-5 w-5" />
                {t('cancelar_asistencia')}
              </button>
            </div>
          )}

          {clase.estado === 'confirmado' && canCancel && (
            <button
              onClick={() => setModal({ type: 'cancelar', clase })}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-error)] px-4 py-3 text-sm font-medium text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20 min-h-[48px] w-full sm:w-auto"
            >
              <XCircle className="h-4 w-4" />
              {t('cancelar_confirmado')}
            </button>
          )}

          {clase.estado === 'confirmado' && !canCancel && (
            <p className="text-sm text-[var(--color-text-muted)]">
              {enCurso ? t('clase_en_curso') : t('clase_ya_paso')}
            </p>
          )}

          {clase.estado === 'cancelado' && (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-error)]">{t('cancelaste')}</p>
              <button
                onClick={() => setModal({ type: 'cambio', clase })}
                className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 min-h-[48px] w-full sm:w-auto"
              >
                <ArrowRight className="h-4 w-4" />
                {t('pedir_otro_horario')}
              </button>
            </div>
          )}

          {clase.estado === 'cambiado' && (
            <p className="text-sm text-[var(--color-info)]">
              {t('esperando_cambio')}
            </p>
          )}
        </Card>

        {/* Notas de clase */}
        {showNotas && (
          <Card padding="lg">
            <NotasSection horarioId={clase.horario.id} />
          </Card>
        )}
      </div>

      {/* Modales */}
      {modal?.type === 'confirmar' && (
        <ConfirmacionForm clase={modal.clase} onConfirm={confirmar} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'cancelar' && (
        <CancelacionForm clase={modal.clase} onCancel={cancelar} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'cambio' && user && (
        <CambioHorarioForm clase={modal.clase} alumnoId={user.id} onCambio={pedirCambio} onClose={() => setModal(null)} />
      )}
    </>
  );
}

/* ── Main page ── */
function AlumnoHorarioContent() {
  const { user } = useUserStore();
  const [horarioId] = useQueryParam('id');
  const [from] = useQueryParam('from');
  const { clases, loading, confirmar, cancelar, pedirCambio } = useAsistencia();
  const { data: pruebas = [] } = usePruebas(user?.id);
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const backHref = getAlumnoHorarioBackHref(from);

  const clase = useMemo(
    () => (horarioId ? clases.find((c) => c.horario.id === horarioId) ?? null : null),
    [clases, horarioId]
  );

  const isExamen = useMemo(
    () => !!horarioId && pruebas.some((p) => p.horario_id === horarioId),
    [pruebas, horarioId]
  );

  // Loading state
  if (loading) {
    return (
      <div>
        <PageHeader title={horarioId ? t('mi_clase') : t('mi_horario')} subtitle={horarioId ? t('detalle_clase') : t('todas_clases')} />
        <div className="mt-[var(--space-lg)] flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      </div>
    );
  }

  // No ?id= param → show list of all clases
  if (!horarioId) {
    return (
      <div>
        <PageHeader title={t('mi_horario')} subtitle={t('todas_clases')} />
        <HorarioListView clases={clases} loading={loading} />
      </div>
    );
  }

  // ?id= present but not found
  if (!clase) {
    return (
      <div>
        <PageHeader title={t('mi_clase')} subtitle={t('detalle_clase')} />
        <div className="mt-[var(--space-lg)]">
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[var(--color-text-primary)] font-medium">{t('clase_no_encontrada')}</p>
            <Link href={backHref} className="mt-3 text-sm text-[var(--color-brand-gold)] hover:underline flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> {t('volver_horario')}
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  // Detail view
  return (
    <div>
      <PageHeader
        title={t('mi_clase')}
        subtitle={t('detalle_clase')}
        actions={
          <Link href={backHref} className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <ArrowLeft className="h-4 w-4" /> {tc('volver')}
          </Link>
        }
      />
      <HorarioDetailView clase={clase} user={user} confirmar={confirmar} cancelar={cancelar} pedirCambio={pedirCambio} isExamen={isExamen} />
    </div>
  );
}

export default function AlumnoHorarioPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" /></div>}>
      <AlumnoHorarioContent />
    </Suspense>
  );
}
