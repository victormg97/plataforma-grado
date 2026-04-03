'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';

import { PageHeader } from '@/components/common/PageHeader';
import { HorariosProfesorView } from '@/components/horarios/HorariosProfesorView';
import { useUser } from '@/lib/hooks/useUser';

function HorariosContent() {
  const t = useTranslations('horarios');
  const { user } = useUser();

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title={t('titulo')}
        subtitle={t('gestion_subtitulo')}
      />
      <HorariosProfesorView profesorId={user.id} role="profesor" />
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
