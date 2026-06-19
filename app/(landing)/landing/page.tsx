import { redirect } from 'next/navigation';
import { HydrationBoundary } from '@tanstack/react-query';
import { tenantConfig } from '@/config';
import { TenantLandingHome, tenantHasLanding } from '@/components/landing';
import { getLandingContext } from '@/components/landing/context';
import { prefetchLandingData } from '@/lib/prefetch/landing';

/**
 * Landing page principal del tenant activo (ruta "/landing").
 *
 * Solo accesible si el tenant tiene `landingPage.habilitado === true` Y tiene
 * una página principal registrada en el registro de `components/landing`.
 * Todas las secciones (planes, sobre nosotras, contacto) se renderizan aquí
 * con scroll continuo.
 *
 * Prefetches dynamic data (pricing, etc.) at server-render time so the client
 * has it immediately via HydrationBoundary — no flash, no loading spinners.
 */
export default async function LandingPage() {
  if (!tenantConfig.landingPage?.habilitado || !tenantHasLanding()) {
    redirect('/login');
  }

  const [ctx, dehydratedState] = await Promise.all([
    getLandingContext(),
    prefetchLandingData(tenantConfig.id),
  ]);

  return (
    <HydrationBoundary state={dehydratedState}>
      <TenantLandingHome {...ctx} />
    </HydrationBoundary>
  );
}
