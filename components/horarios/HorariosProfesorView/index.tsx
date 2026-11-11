'use client';

import { useMemo, useState, useRef } from 'react';
import { es, enUS } from 'date-fns/locale';
import {
  CalendarOff, Search, X, SlidersHorizontal,
  BookOpen, History, ChevronDown, FileText, GraduationCap,
  Plus, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';

import { usePruebaTerm } from '@/lib/hooks/usePruebaTerm';
import { HorarioForm } from '@/components/horarios/HorarioForm';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import { useHorarios } from '@/lib/hooks/useHorarios';
import { usePruebas } from '@/lib/hooks/usePruebas';
import { useHorariosFilters } from './useHorariosFilters';
import { FilterChip } from './FilterChip';
import { ProximaClaseCard } from './ProximaClaseCard';
import { HistorialClaseCard } from './HistorialClaseCard';

type EstadoAsistencia = 'pendiente' | 'confirmado' | 'no_asistio' | 'cancelado' | 'cambiado';

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
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] pl-9 pr-9 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)] transition-shadow"
      />
      {value && (
        <button
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label="Limpiar búsqueda"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
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
        <User className="size-3.5 shrink-0" />
        <span className="truncate max-w-[120px]">
          {selected ? `${selected.nombre} ${selected.apellido}` : t('seleccionar_alumno')}
        </span>
        {value ? (
          <X
            className="size-3 shrink-0 hover:opacity-60 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
          />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
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
            className="w-full h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
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

/* ─────────────────────────── Main component ── */

export type HorariosTabValue = 'proximas' | 'historial';

export type HorariosProfesorViewProps = {
  profesorId: string;
  role: 'profesor' | 'admin';
  /** Controlled tab — when provided the parent owns the active tab state */
  activeTab?: HorariosTabValue;
  onTabChange?: (tab: HorariosTabValue) => void;
};

export function HorariosProfesorView({ profesorId, role, activeTab: activeTabProp, onTabChange }: HorariosProfesorViewProps) {
  const t = useTranslations('horarios');
  const te = useTranslations('asistencia.estados');
  const tc = useTranslations('common');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const pruebaTerm = usePruebaTerm();

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

  const filters = useHorariosFilters({ rawData, pruebaHorarioIds, dateFnsLocale });

  // When controlled from outside, sync the internal filter tab
  const isControlled = activeTabProp !== undefined;
  const resolvedTab = isControlled ? activeTabProp : filters.activeTab;
  const handleTabChange = (tab: HorariosTabValue) => {
    if (isControlled) {
      onTabChange?.(tab);
    } else {
      filters.setActiveTab(tab);
    }
  };

  const [editHorarioId, setEditHorarioId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      {/* Tab bar + Nueva clase button — solo se muestra en modo no controlado (standalone) */}
      {!isControlled && (
      <div className="flex items-end justify-between border-b border-[var(--color-border)] mb-5">
        <div className="flex gap-1">
          <TabButton
            active={resolvedTab === 'proximas'}
            onClick={() => handleTabChange('proximas')}
            count={filters.upcoming.length}
          >
            <BookOpen className="size-4" />
            {t('tab_proximas')}
          </TabButton>
          <TabButton
            active={resolvedTab === 'historial'}
            onClick={() => handleTabChange('historial')}
            count={filters.past.length}
          >
            <History className="size-4" />
            {t('tab_historial')}
          </TabButton>
        </div>
        <button
          onClick={() => setEditHorarioId('new')}
          className="mb-1 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="size-3.5" />
          {t('nueva_clase')}
        </button>
      </div>
      )}

      {/* En modo controlado, el botón "Nueva clase" va aquí arriba sin tab bar */}
      {isControlled && (
        <div className="flex justify-end mb-5 mt-[var(--space-lg)]">
          <button
            onClick={() => setEditHorarioId('new')}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="size-3.5" />
            {t('nueva_clase')}
          </button>
        </div>
      )}

      {/* ── Tab: Próximas ── */}
      {resolvedTab === 'proximas' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <SearchInput
              id="search-proximas"
              value={filters.searchProximas}
              onChange={filters.setSearchProximas}
              placeholder={t('buscar_proximas')}
            />
            <div className="flex flex-wrap items-center gap-2">
              {filters.upcomingStatuses.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)] cursor-pointer shrink-0 ${
                      filters.estadoProximas !== 'todos'
                        ? 'bg-[var(--color-brand-gold-muted)] border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                        : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <SlidersHorizontal className="size-3.5 shrink-0" />
                    <span className="hidden sm:inline">
                      {filters.estadoProximas === 'todos' ? t('todos_estados') : te(filters.estadoProximas)}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="bottom" className="min-w-[180px]">
                    <DropdownMenuRadioGroup
                      value={filters.estadoProximas}
                      onValueChange={(v) => filters.setEstadoProximas(v as typeof filters.estadoProximas)}
                    >
                      <DropdownMenuRadioItem value="todos">
                        {t('todos_estados')}
                      </DropdownMenuRadioItem>
                      <DropdownMenuSeparator />
                      {filters.upcomingStatuses.map((s) => (
                        <DropdownMenuRadioItem key={s} value={s}>
                          {te(s)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {alumnos && alumnos.length > 0 && (
                <AlumnoCombobox
                  alumnos={alumnos}
                  value={filters.selectedAlumnoId}
                  onChange={filters.setSelectedAlumnoId}
                />
              )}
              {filters.hasUpcomingPruebas && (
                <FilterChip
                  active={filters.soloPruebasProximas}
                  onClick={() => filters.setSoloPruebasProximas(!filters.soloPruebasProximas)}
                  icon={<GraduationCap className="size-3.5 shrink-0" />}
                  label={t('filtro_pruebas', { term: pruebaTerm.plural })}
                  tooltip={t('tooltip_filtro_pruebas', { term: pruebaTerm.plural })}
                />
              )}
            </div>
          </div>

          {filters.upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-16 px-4 text-center">
              <CalendarOff className="size-12 text-[var(--color-text-muted)] mb-4" />
              <p className="font-semibold text-[var(--color-text-primary)] mb-1">{t('sin_horarios')}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{t('nueva_descripcion')}</p>
            </div>
          ) : filters.filteredUpcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-12 px-4 text-center">
              <Search className="size-8 text-[var(--color-text-muted)] mb-3" />
              <p className="text-sm text-[var(--color-text-muted)]">
                {filters.debouncedProximas.trim()
                  ? t('sin_resultados_busqueda', { query: filters.debouncedProximas })
                  : t('sin_historial_filtro', { estado: te(filters.estadoProximas as EstadoAsistencia) })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filters.filteredUpcoming.map((h, idx) => (
                <ProximaClaseCard
                  key={h.id}
                  indice={idx}
                  horario={h}
                  isFirst={idx === 0 && !filters.debouncedProximas.trim() && filters.estadoProximas === 'todos' && !filters.soloPruebasProximas && !filters.selectedAlumnoId}
                  isExamen={pruebaHorarioIds.has(h.id)}
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
      {resolvedTab === 'historial' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <SearchInput
              id="search-historial"
              value={filters.searchHistorial}
              onChange={filters.setSearchHistorial}
              placeholder={t('buscar_historial')}
            />
            <div className="flex flex-wrap items-center gap-2">
              {filters.historialStatuses.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)] cursor-pointer ${
                      filters.historialFilter !== 'todos'
                        ? 'bg-[var(--color-brand-gold-muted)] border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                        : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <SlidersHorizontal className="size-3.5 shrink-0" />
                    <span>
                      {filters.historialFilter === 'todos' ? t('todos_estados_historial') : te(filters.historialFilter as EstadoAsistencia)}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="bottom" className="min-w-[180px]">
                    <DropdownMenuRadioGroup
                      value={filters.historialFilter}
                      onValueChange={(v) => filters.setHistorialFilter(v as typeof filters.historialFilter)}
                    >
                      <DropdownMenuRadioItem value="todos">
                        {t('todos_estados_historial')}
                      </DropdownMenuRadioItem>
                      <DropdownMenuSeparator />
                      {filters.historialStatuses.map((s) => (
                        <DropdownMenuRadioItem key={s} value={s}>
                          {te(s)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {alumnos && alumnos.length > 0 && (
                <AlumnoCombobox
                  alumnos={alumnos}
                  value={filters.selectedAlumnoId}
                  onChange={filters.setSelectedAlumnoId}
                />
              )}
              {filters.hasPastNotas && (
                <FilterChip
                  active={filters.soloConNotas}
                  onClick={() => filters.setSoloConNotas(!filters.soloConNotas)}
                  icon={<FileText className="size-3.5 shrink-0" />}
                  label={t('filtro_con_notas')}
                  tooltip={t('tooltip_filtro_notas')}
                />
              )}
              {filters.hasPastPruebas && (
                <FilterChip
                  active={filters.soloPruebas}
                  onClick={() => filters.setSoloPruebas(!filters.soloPruebas)}
                  icon={<GraduationCap className="size-3.5 shrink-0" />}
                  label={t('filtro_pruebas', { term: pruebaTerm.plural })}
                  tooltip={t('tooltip_filtro_pruebas', { term: pruebaTerm.plural })}
                />
              )}
            </div>
          </div>

          {filters.past.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-16 px-4 text-center">
              <History className="size-12 text-[var(--color-text-muted)] mb-4" />
              <p className="font-semibold text-[var(--color-text-primary)]">{t('sin_historial')}</p>
            </div>
          ) : filters.filteredHistorial.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-12 px-4 text-center">
              <Search className="size-8 text-[var(--color-text-muted)] mb-3" />
              <p className="text-sm text-[var(--color-text-muted)]">
                {filters.debouncedHistorial.trim()
                  ? t('sin_resultados_busqueda', { query: filters.debouncedHistorial })
                  : filters.historialFilter !== 'todos'
                    ? t('sin_historial_filtro', { estado: te(filters.historialFilter as EstadoAsistencia) })
                    : t('sin_historial_filtro', {
                        estado: filters.soloConNotas ? t('filtro_con_notas') : t('filtro_pruebas', { term: pruebaTerm.plural }),
                      })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filters.filteredHistorial.map((h, idx) => (
                <HistorialClaseCard
                  key={h.id}
                  indice={idx}
                  horario={h}
                  isExamen={pruebaHorarioIds.has(h.id)}
                  dateFnsLocale={dateFnsLocale}
                  notasCount={filters.notasCounts[h.id] ?? 0}
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
