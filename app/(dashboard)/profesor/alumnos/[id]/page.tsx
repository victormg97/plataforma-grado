import { Suspense } from 'react';
import { FichaAlumnoPage } from '@/components/alumnos/FichaAlumno/FichaAlumnoPage';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

const ALLOWED_BACK_HREFS = [
  '/profesor/mis-alumnos',
  '/profesor/horarios',
];

export default async function ProfesorAlumnoFichaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = from && ALLOWED_BACK_HREFS.includes(from) ? from : '/profesor/mis-alumnos';
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      }
    >
      <FichaAlumnoPage alumnoId={id} role="profesor" backHref={backHref} />
    </Suspense>
  );
}
