import { notFound, redirect } from 'next/navigation';
import { tenantConfig } from '@/config';
import { tenantHasLanding, tenantHasSection } from '@/components/landing';

/**
 * Ruta "/contacto". La sección vive dentro de la página principal con scroll
 * continuo, así que esta URL redirige al ancla correspondiente.
 */
export default async function ContactoRoute() {
  if (!tenantConfig.landingPage?.habilitado || !tenantHasLanding()) {
    redirect('/login');
  }

  if (!tenantHasSection('contacto')) {
    notFound();
  }

  redirect('/landing#contacto');
}
