'use client';

import { useMemo, useState, useRef } from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { es, enUS, type Locale } from 'date-fns/locale';
import {
  Calendar, Clock, CalendarOff, Search, X, SlidersHorizontal,
  BookOpen, History, ChevronDown, FileText, GraduationCap,
  ExternalLink, Edit2, Trash2, Plus, User,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';

import { StatusBadge } from '@/components/common/StatusBadge';
import { NotasIndicator } from '@/components/notas/NotasIndicator';
import { HorarioForm } from '@/components/horarios/HorarioForm';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { Tooltip } from '@/components/common/Tooltip';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import { useHorarios } from '@/lib/hooks/useHorarios';
import { useNotasCount } from '@/lib/hooks/useNotasCount';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { usePruebas } from '@/lib/hooks/usePruebas';
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';
import type { EstadoAsistencia } from '@/lib/supabase/types';

type ActiveTab = 'proximas' | 'historial';
type EstadoFilter = EstadoAsistencia | 'todos';

/* ─────────────────────────────────────────── helpers ── */

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
        type="text"
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

/* ─── alumno combobox ── */
function AlumnoCombobox({
  alumnos,
  value,
  onChange,
}: {
  alumnos: { id: string; nombre: string; apellido: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useTranslations('horarios');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? alumnos.filter((a) =>
        `${a.nombre} ${a.apellido}`.toLowerCase().includes(search.toLowerCase())
      )
    : alumnos;

  const selected = value ? alumnos.find((a) => a.id === value) : null;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch('');
        if (v) setTimeout(() => searchRef.current?.focus(), 0);
      }}
    >
      <DropdownMenuTrigger
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)] cursor-pointer ${
          value
            ? 'bg-[var(--color-brand-gold-muted)] border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
            : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
        }`}
      >
        <User className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate max-w-[120px]">
          {selected ? `${selected.nombre} ${selected.apellido}` : t('seleccionar_alumno')}
        </span>
        {value ? (
          <X
            className="h-3 w-3 shrink-0 hover:opacity-60 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
          />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-56 p-0">
        <div className="p-2 border-b border-[var(--color-border)]">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Buscar alumno…"
            className="w-full h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
          />
        </div>
        <div className="max-h-52 overflow-y-auto py-1">
          <DropdownMenuRadioGroup
            value={value ?? '__all__'}
            onValueChange={(v) => { onChange(v === '__all__' ? null : v); setSearch(''); setOpen(false); }}
          >
            <DropdownMenuRadioItem value="__all__">
              {t('todos_alumnos')}
            </DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {filtered.map((a) => (
              <DropdownMenuRadioItem key={a.id} value={a.id}>
                {a.nombre} {a.apellido}
              </DropdownMenuRadioItem>
            ))}
            {filtered.length === 0 && search.trim() && (
              <p className="px-8 py-1.5 text-sm text-[var(--color-text-muted)]">Sin resultados</p>
            )}
          </DropdownMenuRadioGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

function DayBadge({ fecha }: { fecha: string }) {
  const t = useTranslations('horarios');
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

/* ─────────────────────────── Próximas card ── */

function ProximaClaseCard({
  horario,
  isFirst,
  isExamen,
  locale,
  dateFnsLocale,
  alumnoBasePath,
  fromPath,
  role,
  onEdit,
  onDelete,
}: {
  horario: HorarioConAsistencia;
  isFirst: boolean;
  isExamen: boolean;
  locale: string;
  dateFnsLocale: Locale;
  alumnoBasePath: string;
  fromPath: string;
  role: 'profesor' | 'admin';
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const ta = useTranslations('alumnos');
  const estado = horario.asistencia?.[0]?.estado ?? 'pendiente';

  return (
    <div
      onClick={onEdit}
      className={`relative rounded-[var(--radius-lg)] border bg-[var(--color-bg)] shadow-[var(--shadow-sm)] overflow-hidden cursor-pointer transition-all hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 ${
        isFirst
          ? 'border-[var(--color-brand-gold)]/50 shadow-[var(--shadow-gold)]'
          : 'border-[var(--color-border)]'
      }`}
    >
      {isFirst && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-lg)] bg-[var(--color-brand-gold)]" />
      )}
      <div className={`p-4 ${isFirst ? 'pl-5' : ''}`}>
        {/* Alumno name + status */}
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="min-w-0 flex-1">
            {horario.alumno ? (
              <Tooltip content={ta('ficha_titulo')} position="top">
                <Link
                  href={`${alumnoBasePath}/${horario.alumno.id}?from=${encodeURIComponent(fromPath)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline font-semibold text-[var(--color-text-primary)] underline decoration-dashed decoration-[var(--color-brand-gold)]/60 underline-offset-4 hover:bg-[var(--color-brand-gold-muted)] hover:text-[var(--color-brand-gold)] hover:decoration-solid transition-all rounded px-1 -ml-1"
                >
                  {horario.alumno.nombre} {horario.alumno.apellido}
                </Link>
              </Tooltip>
            ) : (
              <span className="font-semibold text-[var(--color-text-muted)]">—</span>
            )}
          </div>
          <StatusBadge status={estado} />
        </div>

        {/* Title + day badge + exam badge */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <p className="text-sm text-[var(--color-text-secondary)] truncate">{horario.titulo}</p>
          <DayBadge fecha={horario.fecha} />
          {isExamen && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold shrink-0"
              style={{
                backgroundColor: 'var(--color-brand-gold-muted)',
                borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)',
                color: 'var(--color-brand-gold)',
              }}
            >
              <GraduationCap className="h-2.5 w-2.5" />
              {t('badge_examen')}
            </span>
          )}
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 py-1">
            <Calendar className="h-3.5 w-3.5 text-[var(--color-brand-gold)] flex-shrink-0" />
            <span className="capitalize">
              {format(
                new Date(horario.fecha + 'T12:00:00'),
                locale === 'en' ? "EEE, MMM d" : "EEE d 'de' MMM",
                { locale: dateFnsLocale }
              )}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 py-1">
            <Clock className="h-3.5 w-3.5 text-[var(--color-brand-gold)] flex-shrink-0" />
            {horario.hora_inicio.slice(0, 5)} – {horario.hora_fin.slice(0, 5)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex justify-end gap-1">
          <Tooltip content={t('ver_detalle_completo')} position="top">
            <Link
              href={buildClaseDetailHref(horario.id, role, fromPath)}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)]"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Tooltip>
          <Tooltip content={tc('editar')} position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)]"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content={tc('eliminar')} position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-red-50 hover:text-[var(--color-error)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Historial card ── */

function HistorialClaseCard({
  horario,
  isExamen,
  locale,
  dateFnsLocale,
  notasCount,
  alumnoBasePath,
  fromPath,
  role,
  onEdit,
  onDelete,
}: {
  horario: HorarioConAsistencia;
  isExamen: boolean;
  locale: string;
  dateFnsLocale: Locale;
  notasCount: number;
  alumnoBasePath: string;
  fromPath: string;
  role: 'profesor' | 'admin';
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const ta = useTranslations('alumnos');
  const estado = horario.asistencia?.[0]?.estado ?? 'pendiente';

  return (
    <div
      onClick={onEdit}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)] overflow-hidden cursor-pointer transition-all hover:shadow-[var(--shadow-md)] hover:border-[var(--color-border-strong)]"
    >
      <div className="p-4">
        {/* Alumno name */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0 flex-1">
            {horario.alumno ? (
              <Tooltip content={ta('ficha_titulo')} position="top">
                <Link
                  href={`${alumnoBasePath}/${horario.alumno.id}?from=${encodeURIComponent(fromPath)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-semibold text-[var(--color-text-primary)] underline decoration-dashed decoration-[var(--color-brand-gold)]/60 underline-offset-4 hover:text-[var(--color-brand-gold)] rounded px-1 -ml-1 inline"
                >
                  {horario.alumno.nombre} {horario.alumno.apellido}
                </Link>
              </Tooltip>
            ) : (
              <span className="text-sm font-semibold text-[var(--color-text-muted)]">—</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {notasCount > 0 && <NotasIndicator count={notasCount} />}
            <StatusBadge status={estado} />
          </div>
        </div>

        {/* Title + exam badge */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <p className="text-sm text-[var(--color-text-secondary)] truncate">{horario.titulo}</p>
          {isExamen && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold shrink-0"
              style={{
                backgroundColor: 'var(--color-brand-gold-muted)',
                borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)',
                color: 'var(--color-brand-gold)',
              }}
            >
              <GraduationCap className="h-2.5 w-2.5" />
              {t('badge_examen')}
            </span>
          )}
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5">
            <Calendar className="h-3 w-3 text-[var(--color-brand-gold)] flex-shrink-0" />
            <span className="capitalize">
              {format(
                new Date(horario.fecha + 'T12:00:00'),
                locale === 'en' ? "MMM d, yyyy" : "d 'de' MMM yyyy",
                { locale: dateFnsLocale }
              )}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5">
            <Clock className="h-3 w-3 text-[var(--color-brand-gold)] flex-shrink-0" />
            {horario.hora_inicio.slice(0, 5)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex justify-end gap-1">
          <Tooltip content={t('ver_detalle_completo')} position="top">
            <Link
              href={buildClaseDetailHref(horario.id, role, fromPath)}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)]"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Tooltip>
          <Tooltip content={tc('editar')} position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)]"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content={tc('eliminar')} position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-red-50 hover:text-[var(--color-error)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Main component ── */

export type HorariosProfesorViewProps = {
  profesorId: string;
  role: 'profesor' | 'admin';
};

export function HorariosProfesorView({ profesorId, role }: HorariosProfesorViewProps) {
  const t = useTranslations('horarios');
  const te = useTranslations('asistencia.estados');
  const tc = useTranslations('common');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;

  const alumnoBasePath = role === 'admin' ? '/admin/alumnos' : '/profesor/alumnos';
  const fromPath = role === 'admin'
    ? `/admin/profesores/${profesorId}/horarios`
    : '/profesor/horarios';

  const { rawData, alumnos, loading, refetch } = useHorarios(profesorId);
  const { data: pruebas = [] } = usePruebas();
  const pruebaHorarioIds = useMemo(
    () => new Set(pruebas.filter((p) => p.horario_id).map((p) => p.horario_id!)),
    [pruebas]
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('proximas');
  const [editHorarioId, setEditHorarioId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /* Proximas tab state */
  const [searchProximas, setSearchProximas] = useState('');
  const [estadoProximas, setEstadoProximas] = useState<EstadoFilter>('todos');

  /* Historial tab state */
  const [searchHistorial, setSearchHistorial] = useState('');
  const [historialFilter, setHistorialFilter] = useState<EstadoFilter>('todos');
  const [soloConNotas, setSoloConNotas] = useState(false);
  const [soloPruebas, setSoloPruebas] = useState(false);
  const [soloPruebasProximas, setSoloPruebasProximas] = useState(false);
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

  /* Upcoming statuses (for filter dropdown) */
  const upcomingStatuses = useMemo(() => {
    const seen = new Set<EstadoAsistencia>();
    upcoming.forEach((h) => {
      const e = h.asistencia?.[0]?.estado;
      if (e) seen.add(e);
    });
    return Array.from(seen);
  }, [upcoming]);

  /* Historial statuses */
  const historialStatuses = useMemo(() => {
    const seen = new Set<EstadoAsistencia>();
    past.forEach((h) => {
      const e = h.asistencia?.[0]?.estado;
      if (e) seen.add(e);
    });
    return Array.from(seen);
  }, [past]);

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
  }, [
    past,
    historialFilter,
    soloConNotas,
    soloPruebas,
    notasCounts,
    pruebaHorarioIds,
    selectedAlumnoId,
    debouncedHistorial,
    dateFnsLocale,
  ]);

  const editingHorario = useMemo(
    () =>
      editHorarioId && editHorarioId !== 'new'
        ? rawData.find((h) => h.id === editHorarioId)
        : undefined,
    [editHorarioId, rawData]
  );

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/horarios/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success(t('exito_eliminado'));
      refetch();
    } catch {
      toast.error(t('error_eliminar'));
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-[var(--space-lg)] space-y-3">
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="mt-[var(--space-lg)]">
      {/* Tab bar + Nueva clase button */}
      <div className="flex items-end justify-between border-b border-[var(--color-border)] mb-5">
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
        <button
          onClick={() => setEditHorarioId('new')}
          className="mb-1 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('nueva_clase')}
        </button>
      </div>

      {/* ── Tab: Próximas ── */}
      {activeTab === 'proximas' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <SearchInput
              id="search-proximas"
              value={searchProximas}
              onChange={setSearchProximas}
              placeholder={t('buscar_proximas')}
            />
            <div className="flex flex-wrap items-center gap-2">
              {upcomingStatuses.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)] cursor-pointer shrink-0 ${
                      estadoProximas !== 'todos'
                        ? 'bg-[var(--color-brand-gold-muted)] border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                        : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">
                      {estadoProximas === 'todos' ? t('todos_estados') : te(estadoProximas)}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="bottom" className="min-w-[180px]">
                    <DropdownMenuRadioGroup
                      value={estadoProximas}
                      onValueChange={(v) => setEstadoProximas(v as EstadoFilter)}
                    >
                      <DropdownMenuRadioItem value="todos">
                        {t('todos_estados')}
                      </DropdownMenuRadioItem>
                      <DropdownMenuSeparator />
                      {upcomingStatuses.map((s) => (
                        <DropdownMenuRadioItem key={s} value={s}>
                          {te(s)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {/* Alumno filter */}
              {alumnos && alumnos.length > 0 && (
                <AlumnoCombobox
                  alumnos={alumnos}
                  value={selectedAlumnoId}
                  onChange={setSelectedAlumnoId}
                />
              )}
              {/* Exámenes filter chip */}
              <Tooltip content={t('tooltip_filtro_pruebas')} position="top">
                <button
                  onClick={() => setSoloPruebasProximas(!soloPruebasProximas)}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] border text-sm font-medium transition-colors select-none ${
                    soloPruebasProximas
                      ? 'bg-[var(--color-brand-gold-muted)] border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                      soloPruebasProximas
                        ? 'bg-[var(--color-brand-gold)] border-[var(--color-brand-gold)]'
                        : 'border-[var(--color-border-strong)]'
                    }`}
                  >
                    {soloPruebasProximas && (
                      <svg viewBox="0 0 8 8" className="h-2.5 w-2.5 text-white fill-current">
                        <path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    )}
                  </span>
                  <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                  {t('filtro_pruebas')}
                </button>
              </Tooltip>
            </div>
          </div>

          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-16 px-4 text-center">
              <CalendarOff className="h-12 w-12 text-[var(--color-text-muted)] mb-4" />
              <p className="font-semibold text-[var(--color-text-primary)] mb-1">{t('sin_horarios')}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{t('nueva_descripcion')}</p>
            </div>
          ) : filteredUpcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-12 px-4 text-center">
              <Search className="h-8 w-8 text-[var(--color-text-muted)] mb-3" />
              <p className="text-sm text-[var(--color-text-muted)]">
                {debouncedProximas.trim()
                  ? t('sin_resultados_busqueda', { query: debouncedProximas })
                  : t('sin_historial_filtro', { estado: te(estadoProximas as EstadoAsistencia) })}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUpcoming.map((h, idx) => (
                <ProximaClaseCard
                  key={h.id}
                  horario={h}
                  isFirst={idx === 0 && !debouncedProximas.trim() && estadoProximas === 'todos' && !soloPruebasProximas && !selectedAlumnoId}
                  isExamen={pruebaHorarioIds.has(h.id)}
                  locale={locale}
                  dateFnsLocale={dateFnsLocale}
                  alumnoBasePath={alumnoBasePath}
                  fromPath={fromPath}
                  role={role}
                  onEdit={() => setEditHorarioId(h.id)}
                  onDelete={() => setDeleteId(h.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Historial ── */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <SearchInput
              id="search-historial"
              value={searchHistorial}
              onChange={setSearchHistorial}
              placeholder={t('buscar_historial')}
            />
            {/* Filter chips */}
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
                      {historialFilter === 'todos' ? t('todos_estados_historial') : te(historialFilter as EstadoAsistencia)}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="bottom" className="min-w-[180px]">
                    <DropdownMenuRadioGroup
                      value={historialFilter}
                      onValueChange={(v) => setHistorialFilter(v as EstadoFilter)}
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

              {/* Alumno filter */}
              {alumnos && alumnos.length > 0 && (
                <AlumnoCombobox
                  alumnos={alumnos}
                  value={selectedAlumnoId}
                  onChange={setSelectedAlumnoId}
                />
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
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                      soloConNotas
                        ? 'bg-[var(--color-brand-gold)] border-[var(--color-brand-gold)]'
                        : 'border-[var(--color-border-strong)]'
                    }`}
                  >
                    {soloConNotas && (
                      <svg viewBox="0 0 8 8" className="h-2.5 w-2.5 text-white fill-current">
                        <path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
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
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                      soloPruebas
                        ? 'bg-[var(--color-brand-gold)] border-[var(--color-brand-gold)]'
                        : 'border-[var(--color-border-strong)]'
                    }`}
                  >
                    {soloPruebas && (
                      <svg viewBox="0 0 8 8" className="h-2.5 w-2.5 text-white fill-current">
                        <path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
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
                    ? t('sin_historial_filtro', { estado: te(historialFilter as EstadoAsistencia) })
                    : t('sin_historial_filtro', {
                        estado: soloConNotas ? t('filtro_con_notas') : t('filtro_pruebas'),
                      })}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredHistorial.map((h) => (
                <HistorialClaseCard
                  key={h.id}
                  horario={h}
                  isExamen={pruebaHorarioIds.has(h.id)}
                  locale={locale}
                  dateFnsLocale={dateFnsLocale}
                  notasCount={notasCounts[h.id] ?? 0}
                  alumnoBasePath={alumnoBasePath}
                  fromPath={fromPath}
                  role={role}
                  onEdit={() => setEditHorarioId(h.id)}
                  onDelete={() => setDeleteId(h.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* HorarioForm modal */}
      <HorarioForm
        open={!!editHorarioId}
        onClose={() => setEditHorarioId(null)}
        profesorId={profesorId}
        horario={editingHorario}
        onSuccess={refetch}
        cachedAlumnos={alumnos ?? undefined}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => !isDeleting && setDeleteId(null)}
        onConfirm={confirmDelete}
        title={t('confirmar_eliminar')}
        description={tc('eliminar') + ' permanentemente'}
        confirmText={tc('eliminar')}
        cancelText={tc('cancelar')}
        loading={isDeleting}
        isDanger={true}
      />
    </div>
  );
}
