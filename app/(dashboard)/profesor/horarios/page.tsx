'use client';

import { Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { HorarioForm } from '@/components/horarios/HorarioForm';
import { useHorarios, type HorarioConAsistencia } from '@/lib/hooks/useHorarios';
import { useUser } from '@/lib/hooks/useUser';
import { useQueryParam } from '@/lib/hooks/useQueryParam';

const PAGE_SIZE = 20;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function HorariosContent() {
  const t = useTranslations('horarios');
  const ta = useTranslations('asistencia.estados');
  const tc = useTranslations('common');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const { user } = useUser();
  const { rawData, alumnos, loading, refetch } = useHorarios(user?.id);

  const [qParam, setQParam] = useQueryParam('q');
  const [estadoParam, setEstadoParam] = useQueryParam('estado');
  const [horarioParam, setHorarioParam] = useQueryParam('horario');

  const search = qParam ?? '';
  const debouncedSearch = useDebouncedValue(search, 300);
  const estadoFilter = estadoParam ?? '';

  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let data = [...rawData];

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter(
        (h) =>
          h.titulo.toLowerCase().includes(q) ||
          h.alumno?.nombre?.toLowerCase().includes(q) ||
          h.alumno?.apellido?.toLowerCase().includes(q)
      );
    }

    if (estadoFilter) {
      data = data.filter((h) => h.asistencia?.[0]?.estado === estadoFilter);
    }

    data.sort((a, b) => {
      const cmp = a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio);
      return sortAsc ? cmp : -cmp;
    });

    return data;
  }, [rawData, debouncedSearch, estadoFilter, sortAsc]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Editing from URL param
  const editing = useMemo(
    () => (horarioParam ? rawData.find((h) => h.id === horarioParam) ?? null : null),
    [horarioParam, rawData]
  );

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmar_eliminar'))) return;
    try {
      const res = await fetch(`/api/horarios/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success(t('exito_eliminado'));
      refetch();
    } catch {
      toast.error(t('error_eliminar'));
    }
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
            value={search}
            onChange={(e) => { setQParam(e.target.value || null); setPage(0); }}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
          />
        </div>
        <select
          value={estadoFilter}
          onChange={(e) => { setEstadoParam(e.target.value || null); setPage(0); }}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none"
        >
          <option value="">{t('todos_estados')}</option>
          <option value="pendiente">{ta('pendiente')}</option>
          <option value="confirmado">{ta('confirmado')}</option>
          <option value="cancelado">{ta('cancelado')}</option>
          <option value="cambiado">{ta('cambiado')}</option>
        </select>
        <button
          onClick={() => setSortAsc((p) => !p)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          {t('fecha')} {sortAsc ? '↑' : '↓'}
        </button>
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
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-text-muted)]">
                <th className="px-3 py-2">{t('campo_alumno')}</th>
                <th className="px-3 py-2">{t('col_titulo_tabla')}</th>
                <th className="px-3 py-2">{t('fecha')}</th>
                <th className="px-3 py-2">{t('col_hora')}</th>
                <th className="px-3 py-2">{tc('estado')}</th>
                <th className="px-3 py-2 text-right">{t('acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((h) => {
                const estado = h.asistencia?.[0]?.estado ?? 'pendiente';
                return (
                  <tr key={h.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors">
                    <td className="px-3 py-2.5 font-medium text-[var(--color-text-primary)]">
                      {h.alumno ? (
                        <Link
                          href={`/profesor/mis-alumnos?alumno=${h.alumno.id}`}
                          className="underline decoration-[var(--color-brand-gold)]/40 underline-offset-2 transition-colors hover:text-[var(--color-brand-gold)]"
                        >
                          {h.alumno.nombre} {h.alumno.apellido}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-text-primary)]">{h.titulo}</td>
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
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setHorarioParam(h.id)}
                          className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)]"
                          title={tc('editar')}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(h.id)}
                          className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-red-50 hover:text-[var(--color-error)]"
                          title={tc('eliminar')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-muted)] disabled:opacity-40"
            >
              {t('anterior')}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-muted)] disabled:opacity-40"
            >
              {t('siguiente')}
            </button>
          </div>
        </div>
      )}

      {/* Form modal */}
      <HorarioForm
        open={!!horarioParam}
        onClose={() => setHorarioParam(null)}
        profesorId={user.id}
        horario={horarioParam !== 'new' ? (editing ?? undefined) : undefined}
        onSuccess={refetch}
        cachedAlumnos={alumnos}
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
