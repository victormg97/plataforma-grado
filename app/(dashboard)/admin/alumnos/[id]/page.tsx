import { Suspense } from 'react';
import { FichaAlumnoPage } from '@/components/alumnos/FichaAlumno/FichaAlumnoPage';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminAlumnoFichaPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      }
    >
      <FichaAlumnoPage alumnoId={id} role="admin" backHref="/admin/alumnos" />
    </Suspense>
  );
}
