'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { Edit2, Plus, Search, Trash2, ArrowUp, ArrowDown, ExternalLink, ChevronDown, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { Tooltip } from '@/components/common/Tooltip';

import { HorarioForm } from '@/components/horarios/HorarioForm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotasIndicator } from '@/components/notas/NotasIndicator';

import { useNotasCount } from '@/lib/hooks/useNotasCount';
import { useHorarios } from '@/lib/hooks/useHorarios';
import { useUser } from '@/lib/hooks/useUser';
import { useQueryParam } from '@/lib/hooks/useQueryParam';
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';
import { usePruebas } from '@/lib/hooks/usePruebas';

const PAGE_SIZE = 20;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

type SortField = 'alumno' | 'titulo' | 'fecha' | 'hora' | 'estado';

function HorariosContent() {
  const t = useTranslations('horarios');
  const ta = useTranslations('asistencia.estados');
  const talumnos = useTranslations('alumnos');
  const tc = useTranslations('common');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const router = useRouter();
  const { user } = useUser();
  const { rawData, alumnos, loading, refetch } = useHorarios(user?.id);

  // Build a Set of horario IDs that are exam classes
  const { data: pruebas = [] } = usePruebas();
  const pruebaHorarioIds = useMemo(
    () => new Set(pruebas.filter((p) => p.horario_id).map((p) => p.horario_id!)),
    [pruebas]
  );

  const [qParam, setQParam] = useQueryParam('q');
  const [estadoParam, setEstadoParam] = useQueryParam('estado');
  const [horarioParam, setHorarioParam] = useQueryParam('horario');

  // Debounced search state
  const [localSearch, setLocalSearch] = useState(qParam ?? '');
  const debouncedSearch = useDebouncedValue(localSearch, 500);

  // Sync debounced term back to URL without rendering loops
  useEffect(() => {
    if (debouncedSearch !== (qParam ?? '')) {
      setQParam(debouncedSearch || null);
      setPage(0);
    }
  }, [debouncedSearch, qParam, setQParam]);

  const estadoFilter = estadoParam ?? '';
  const [sortField, setSortField] = useState<SortField>('fecha');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    let data = [...rawData];

    // Search Combinado
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      data = data.filter((h) => {
        const nombreStr = h.alumno?.nombre?.toLowerCase() || '';
        const apellidoStr = h.alumno?.apellido?.toLowerCase() || '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apellidoMaternoStr = (h.alumno as any)?.apellido_materno?.toLowerCase() || '';
        const fullNombre = `${nombreStr} ${apellidoStr} ${apellidoMaternoStr}`.trim();
        return (
          h.titulo.toLowerCase().includes(q) ||
          fullNombre.includes(q) ||
          nombreStr.includes(q) ||
          apellidoStr.includes(q) ||
          apellidoMaternoStr.includes(q)
        );
      });
    }

    if (estadoFilter) {
      data = data.filter((h) => h.asistencia?.[0]?.estado === estadoFilter);
    }

    // Ordenamiento Dinámico
    data.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'alumno': {
          const nameA = `${a.alumno?.nombre || ''} ${a.alumno?.apellido || ''}`.trim();
          const nameB = `${b.alumno?.nombre || ''} ${b.alumno?.apellido || ''}`.trim();
          cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
          break;
        }
        case 'titulo':
          cmp = a.titulo.localeCompare(b.titulo, undefined, { sensitivity: 'base' });
          break;
        case 'hora':
            cmp = a.hora_inicio.localeCompare(b.hora_inicio);
            break;
        case 'estado': {
          const estA = a.asistencia?.[0]?.estado ?? 'pendiente';
          const estB = b.asistencia?.[0]?.estado ?? 'pendiente';
          cmp = estA.localeCompare(estB);
          break;
        }
        case 'fecha':
        default:
          cmp = a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return data;
  }, [rawData, debouncedSearch, estadoFilter, sortAsc, sortField]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Editing from URL param
  const editing = useMemo(
    () => (horarioParam ? rawData.find((h) => h.id === horarioParam) ?? null : null),
    [horarioParam, rawData]
  );
  
  // Query counts for the current page
  const notableIds = useMemo(
    () => paged.filter((h) => {
      const e = h.asistencia?.[0]?.estado;
      return e === 'confirmado' || e === 'no_asistio';
    }).map((c) => c.id),
    [paged]
  );
  const notasCounts = useNotasCount(notableIds);

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />;
  };

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title={t('titulo')}
        subtitle={t('gestion_subtitulo')}
        actions={
          <Button onClick={() => setHorarioParam('new')}>
            <Plus className="mr-1.5 h-4 w-4" /> {t('nueva_clase')}
          </Button>
        }
      />

      {/* Filters */}
      <div className="mt-[var(--space-md)] flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder={t('buscar_placeholder')}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none cursor-pointer">
            {estadoFilter ? ta(estadoFilter) : t('todos_estados')}
            <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => { setEstadoParam(null); setPage(0); }}>
              {t('todos_estados')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEstadoParam('pendiente'); setPage(0); }}>
              {ta('pendiente')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEstadoParam('confirmado'); setPage(0); }}>
              {ta('confirmado')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEstadoParam('cancelado'); setPage(0); }}>
              {ta('cancelado')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEstadoParam('cambiado'); setPage(0); }}>
              {ta('cambiado')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <Card padding="sm" className="mt-[var(--space-md)] overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
          </div>
        ) : paged.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            {t('sin_resultados')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-text-muted)] [&>th]:px-3 [&>th]:py-2 [&>th]:select-none">
                <th
                  className="cursor-pointer hover:text-[var(--color-text-primary)] transition-colors"
                  onClick={() => handleSort('alumno')}
                >
                  {t('campo_alumno')}
                  <SortIcon field="alumno" />
                </th>
                <th
                  className="cursor-pointer hover:text-[var(--color-text-primary)] transition-colors"
                  onClick={() => handleSort('titulo')}
                >
                  {t('col_titulo_tabla')}
                  <SortIcon field="titulo" />
                </th>
                <th
                  className="cursor-pointer hover:text-[var(--color-text-primary)] transition-colors"
                  onClick={() => handleSort('fecha')}
                >
                  {t('fecha')}
                  <SortIcon field="fecha" />
                </th>
                <th
                  className="cursor-pointer hover:text-[var(--color-text-primary)] transition-colors"
                  onClick={() => handleSort('hora')}
                >
                  {t('col_hora')}
                  <SortIcon field="hora" />
                </th>
                <th
                  className="cursor-pointer hover:text-[var(--color-text-primary)] transition-colors"
                  onClick={() => handleSort('estado')}
                >
                  {tc('estado')}
                  <SortIcon field="estado" />
                </th>
                <th className="text-right pointer-events-none">{t('acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((h) => {
                const estado = h.asistencia?.[0]?.estado ?? 'pendiente';
                return (
                  <tr
                    key={h.id}
                    onClick={() => setHorarioParam(h.id)}
                    className={`group border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer ${pruebaHorarioIds.has(h.id) ? 'border-l-2 border-l-[var(--color-brand-gold)]' : ''}`}
                  >
                    <td className="px-3 py-2.5 font-medium text-[var(--color-text-primary)]">
                      {h.alumno ? (
                        <Tooltip content={talumnos('ficha_titulo')} position="top">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/profesor/alumnos/${h.alumno?.id}?from=/profesor/horarios`);
                            }}
                            className="cursor-pointer px-2 py-1 -ml-2 rounded-md font-semibold text-[var(--color-text-primary)] underline decoration-dashed decoration-[var(--color-brand-gold)]/60 underline-offset-4 hover:bg-[var(--color-brand-gold-muted)] hover:text-[var(--color-brand-gold)] hover:decoration-solid transition-all text-left"
                          >
                            {h.alumno.nombre} {h.alumno.apellido}
                          </button>
                        </Tooltip>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-text-primary)]">
                        <div className="flex items-center gap-2">
                            <span>{h.titulo}</span>
                            {/* Mostrar badge de notas si existe conteo desde useNotasCount o fallback */}
                            {(notasCounts[h.id] > 0 || (h.notas_count && h.notas_count > 0)) ? (
                                <NotasIndicator count={notasCounts[h.id] || h.notas_count || 0} />
                            ) : null}
                            {pruebaHorarioIds.has(h.id) && (
                              <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                                <GraduationCap className="h-3 w-3" />
                                {t('badge_examen')}
                              </span>
                            )}
                        </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-text-muted)]">
                      {format(new Date(h.fecha), locale === 'en' ? 'EEE MMM d' : 'EEE d MMM', { locale: dateFnsLocale })}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-text-muted)]">
                      {h.hora_inicio.slice(0, 5)} – {h.hora_fin.slice(0, 5)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={estado} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Tooltip content={t('ver_detalle_completo')} position="top">
                          <Link
                            href={buildClaseDetailHref(h.id, 'profesor', '/profesor/horarios')}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer inline-flex rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)]"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Tooltip>

                        <Tooltip content={tc('editar')} position="top">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setHorarioParam(h.id);
                            }}
                            className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)]"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </Tooltip>

                        <Tooltip content={tc('eliminar')} position="top">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(h.id);
                            }}
                            className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-red-50 hover:text-[var(--color-error)]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-[var(--space-md)] flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">
            {t('pagina', { page: page + 1, total: totalPages, count: filtered.length })}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-muted)] disabled:opacity-40 transition-colors hover:bg-[var(--color-bg-secondary)]"
            >
              {t('anterior')}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-muted)] disabled:opacity-40 transition-colors hover:bg-[var(--color-bg-secondary)]"
            >
              {t('siguiente')}
            </button>
          </div>
        </div>
      )}

      {/* Modals y Formatos Separados */}
      <HorarioForm
        open={!!horarioParam}
        onClose={() => setHorarioParam(null)}
        profesorId={user.id}
        horario={horarioParam !== 'new' ? (editing ?? undefined) : undefined}
        onSuccess={refetch}
        cachedAlumnos={alumnos}
      />

      <ConfirmModal
        open={!!deleteId}
        onClose={() => !isDeleting && setDeleteId(null)}
        onConfirm={confirmDelete}
        title={t('confirmar_eliminar')}
        description={tc('eliminar') + " permanentemente"}
        confirmText={tc('eliminar')}
        cancelText={tc('cancelar')}
        loading={isDeleting}
        isDanger={true}
      />
    </div>
  );
}

export default function HorariosPage() {
  return (
    <Suspense>
      <HorariosContent />
    </Suspense>
  );
}
