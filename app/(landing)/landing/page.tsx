import { redirect } from 'next/navigation';
import { tenantConfig } from '@/config';
import { TenantLandingHome, tenantHasLanding } from '@/components/landing';
import { getLandingContext } from '@/components/landing/context';

/**
 * Landing page principal del tenant activo (ruta "/landing").
 *
 * Solo accesible si el tenant tiene `landingPage.habilitado === true` Y tiene
 * una página principal registrada en el registro de `components/landing`.
 * Todas las secciones (planes, sobre nosotras, contacto) se renderizan aquí
 * con scroll continuo.
 */
export default async function LandingPage() {
  if (!tenantConfig.landingPage?.habilitado || !tenantHasLanding()) {
    redirect('/login');
  }

  const ctx = await getLandingContext();
  return <TenantLandingHome {...ctx} />;
}
