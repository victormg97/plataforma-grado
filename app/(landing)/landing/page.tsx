import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

/**
 * Landing page público del tenant.
 * Solo accesible si `tenantConfig.landingPage.habilitado === true`.
 *
 * — Usuario no logeado: ve el landing con botón "Iniciar sesión"
 * — Usuario logeado:    ve el landing con botón "Ir a la plataforma"
 *
 * Este es un template mínimo (hello world). El diseño real se implementará
 * en una iteración posterior.
 */
export default async function LandingPage() {
  // Tenants sin landing page no tienen acceso a esta ruta
  if (!tenantConfig.landingPage?.habilitado) {
    redirect('/login');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let dashboardPath: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (profile) {
      dashboardPath = getRolRedirectPath(profile.rol);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1
        className="text-4xl font-bold"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand-gold)' }}
      >
        {tenantConfig.nombre}
      </h1>

      <p className="text-lg text-[var(--color-text-muted)]">
        {tenantConfig.descripcion}
      </p>

      <p className="text-sm text-[var(--color-text-muted)] opacity-60">
        Hello world — landing page en construcción
      </p>

      {dashboardPath ? (
        <Link
          href={dashboardPath}
          className="rounded-lg px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-brand-gold)' }}
        >
          Ir a la plataforma
        </Link>
      ) : (
        <Link
          href="/login"
          className="rounded-lg px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-brand-gold)' }}
        >
          Iniciar sesión
        </Link>
      )}
    </main>
  );
}
