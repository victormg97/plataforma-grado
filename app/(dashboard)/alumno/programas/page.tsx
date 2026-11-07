import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/common/PageHeader';
import { MisCedularios } from '@/components/cedularios/seguimiento/alumno/MisCedularios';

/**
 * Student programs index. Hosts the read-only "Mis cedularios" section.
 *
 * Role protection: `proxy.ts` only lets the `alumno` role into `/alumno/*`
 * (admin, profesor and lector are redirected to their own dashboard), so the
 * section is never rendered for a lector. RLS still returns only the student's own rows.
 * The class-program detail lives in `./[id]/page.tsx` and is not affected.
 */
export default async function AlumnoProgramasPage() {
  const tNav = await getTranslations('nav');

  return (
    <div>
      <PageHeader title={tNav('programas')} />

      <div className="mt-[var(--space-lg)]">
        {/* MisCedularios reads `seg_*` with useSearchParams, so it needs a Suspense boundary. */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
            </div>
          }
        >
          <MisCedularios />
        </Suspense>
      </div>
    </div>
  );
}
