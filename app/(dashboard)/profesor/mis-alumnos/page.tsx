'use client';

import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { AlumnoCard, type AlumnoConExtra } from '@/components/alumnos/AlumnoCard';
import { useUser } from '@/lib/hooks/useUser';
import { useQueryParam } from '@/lib/hooks/useQueryParam';

type Tab = 'mis' | 'todos';

function MisAlumnosContent() {
  const t = useTranslations('alumnos');
  const { user } = useUser();
  const router = useRouter();
  const [tabParam, setTabParam] = useQueryParam('tab');
  const [qParam, setQParam] = useQueryParam('q');

  const tab: Tab = tabParam === 'todos' ? 'todos' : 'mis';
  const search = qParam ?? '';

  const { data: alumnos = [], isLoading: loading } = useQuery<AlumnoConExtra[]>({
    queryKey: ['alumnos', tab],
    queryFn: async () => {
      const res = await fetch(`/api/alumnos?scope=${tab}`);
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return alumnos;
    const q = search.toLowerCase();
    return alumnos.filter(
      (a) =>
        a.nombre.toLowerCase().includes(q) ||
        a.apellido.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
    );
  }, [alumnos, search]);



  return (
    <div>
      <PageHeader
        title={t('mis_alumnos_tab')}
        subtitle={t('ficha_conteo', { count: filtered.length })}
      />

      {/* Tabs */}
      <div className="mt-[var(--space-md)] flex gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1">
        {([
          { key: 'mis' as Tab, label: t('mis_alumnos_tab') },
          { key: 'todos' as Tab, label: t('todos_alumnos_tab') },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTabParam(t.key === 'mis' ? null : t.key)}
            className={`flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[var(--color-bg)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mt-[var(--space-md)]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder={t('buscar_nombre_email')}
          value={search}
          onChange={(e) => setQParam(e.target.value || null)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="mt-[var(--space-xl)] flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-[var(--space-xl)] flex flex-col items-center gap-2 text-[var(--color-text-muted)]">
          <Users className="h-12 w-12 opacity-50" />
          <p className="text-sm">
            {search ? t('sin_resultados_busqueda') : t('sin_asignados')}
          </p>
        </div>
      ) : (
        <div className="mt-[var(--space-md)] grid grid-cols-1 gap-[var(--space-md)] sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((alumno) => (
            <AlumnoCard
              key={alumno.id}
              alumno={alumno}
              onViewFicha={(a) => router.push(`/profesor/alumnos/${a.id}`)}
              isOwn={tab === 'mis'}
            />
          ))}
        </div>
      )}

    </div>
  );
}

export default function MisAlumnosPage() {
  return (
    <Suspense>
      <MisAlumnosContent />
    </Suspense>
  );
}
