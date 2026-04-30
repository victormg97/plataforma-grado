import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RecursosView } from '@/components/recursos/RecursosView';

export default async function AdminRecursosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') redirect('/');

  return <RecursosView rol="admin" />;
}
