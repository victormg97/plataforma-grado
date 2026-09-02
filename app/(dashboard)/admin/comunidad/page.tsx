import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminPanel } from '@/components/comunidad/admin/AdminPanel';

/**
 * Dedicated admin route for Comunidad Estratégica configuration (Req. 9).
 * Server-side admin guard mirrors the pattern of app/(dashboard)/admin/recursos.
 * The panel uses global platform tokens (not the GameThemeScope skin).
 */
export default async function AdminComunidadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') redirect('/');

  return <AdminPanel />;
}
