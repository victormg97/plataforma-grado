import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import { tenantConfig } from '@/config';

export default async function Home() {
  const landing = tenantConfig.landingPage;

  // ── Tenant sin landing page: comportamiento original ─────────────────────
  if (!landing?.habilitado) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (profile) {
        redirect(getRolRedirectPath(profile.rol));
      }
    }

    redirect('/login');
  }

  // ── Tenant con landing page ──────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user && !landing.usuarioLogeadoVeLanding) {
    // El tenant prefiere redirigir al usuario logeado directo a su dashboard
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (profile) {
      redirect(getRolRedirectPath(profile.rol));
    }
  }

  // Mostrar el landing page (usuario logeado o no)
  redirect('/landing');
}
