import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CaseReviewInbox } from '@/components/comunidad/admin/CaseReviewInbox';

/**
 * Weekly-case answer review inbox (admin). Dedicated route so it stays out of
 * the player-facing game. Server-side admin guard mirrors admin/comunidad.
 * Deep-linkable via ?case= and ?user= (read client-side).
 */
export default async function CasosRevisionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') redirect('/');

  return <CaseReviewInbox />;
}
