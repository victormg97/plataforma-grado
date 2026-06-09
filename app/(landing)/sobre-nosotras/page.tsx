import { notFound, redirect } from 'next/navigation';
import { tenantConfig } from '@/config';
import { tenantHasLanding, tenantHasSection } from '@/components/landing';

/**
 * Ruta "/sobre-nosotras". La sección vive dentro de la página principal con
 * scroll continuo, así que esta URL redirige al ancla correspondiente.
 */
export default async function SobreNosotrasRoute() {
  if (!tenantConfig.landingPage?.habilitado || !tenantHasLanding()) {
    redirect('/login');
  }

  if (!tenantHasSection('sobre-nosotras')) {
    notFound();
  }

  redirect('/landing#sobre-nosotras');
}
