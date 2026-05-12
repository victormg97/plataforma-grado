'use client';

import { Suspense } from 'react';
import { use } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { PageHeader } from '@/components/common/PageHeader';
import { HorariosProfesorView } from '@/components/horarios/HorariosProfesorView';

type Profesor = {
  id: string;
  nombre: string;
  apellido: string;
};

function ProfesorHorariosContent({ profesorId }: { profesorId: string }) {
  const tp = useTranslations('profesores');
  const th = useTranslations('horarios');

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
      <HorariosProfesorView profesorId={profesorId} role="admin" />
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
