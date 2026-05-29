'use client';

import { Suspense, useState } from 'react';
import { use } from 'react';
import { ArrowLeft, BookOpen, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import { PageHeader } from '@/components/common/PageHeader';
import { HorariosProfesorView } from '@/components/horarios/HorariosProfesorView';
import { CalendarioProfesor } from '@/components/calendario/CalendarioProfesor';

type Profesor = {
  id: string;
  nombre: string;
  apellido: string;
};

type ActiveTab = 'clases' | 'agenda';

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
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
    </button>
  );
}

function ProfesorHorariosContent({ profesorId }: { profesorId: string }) {
  const tp = useTranslations('profesores');
  const th = useTranslations('horarios');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialTab: ActiveTab =
    searchParams.get('tab') === 'agenda' ? 'agenda' : 'clases';
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'clases') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const { data: profesor } = useQuery<Profesor>({
    queryKey: ['admin-profesor', profesorId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/profesores/${profesorId}`);
      if (!res.ok) throw new Error('Not found');
      return res.json();
    },
    staleTime: 60_000,
  });

  const title = profesor
    ? tp('clases_de', { nombre: `${profesor.nombre} ${profesor.apellido}` })
    : th('titulo');

  return (
    <div>
      <div className="mb-1">
        <Link
          href="/admin/profesores"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          {tp('titulo')}
        </Link>
      </div>
      <PageHeader
        title={title}
        subtitle={tp('ver_clases_subtitulo')}
      />

      {/* Tab bar */}
      <div className="flex items-end border-b border-[var(--color-border)] mt-[var(--space-lg)] mb-0">
        <TabButton
          active={activeTab === 'clases'}
          onClick={() => handleTabChange('clases')}
        >
          <BookOpen className="size-4" />
          {th('tab_clases')}
        </TabButton>
        <TabButton
          active={activeTab === 'agenda'}
          onClick={() => handleTabChange('agenda')}
        >
          <CalendarDays className="size-4" />
          {th('tab_agenda')}
        </TabButton>
      </div>

      {/* Tab content */}
      {activeTab === 'clases' && (
        <HorariosProfesorView profesorId={profesorId} role="admin" />
      )}
      {activeTab === 'agenda' && (
        <div className="mt-[var(--space-lg)]">
          <CalendarioProfesor profesorId={profesorId} />
        </div>
      )}
    </div>
  );
}

export default function ProfesorHorariosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense>
      <ProfesorHorariosContent profesorId={id} />
    </Suspense>
  );
}
