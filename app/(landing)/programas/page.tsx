import { notFound, redirect } from 'next/navigation';
import { tenantConfig } from '@/config';
import { tenantHasLanding, tenantHasSection } from '@/components/landing';

/**
 * Ruta "/programas". La sección vive dentro de la página principal con scroll
 * continuo, así que esta URL redirige al ancla correspondiente.
 */
export default async function ProgramasRoute() {
  if (!tenantConfig.landingPage?.habilitado || !tenantHasLanding()) {
    redirect('/login');
  }

  if (!tenantHasSection('programas')) {
    notFound();
  }

  redirect('/landing#programas');
}
