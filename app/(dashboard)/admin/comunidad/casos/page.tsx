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
  // Local JWT verification (no extra Auth round-trip on top of the proxy's).
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', userId)
    .single();

  if (profile?.rol !== 'admin') redirect('/');

  return <CaseReviewInbox />;
}
