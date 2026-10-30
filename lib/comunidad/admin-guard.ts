import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side guard for the Comunidad Estratégica admin API routes.
 * Returns the authenticated admin user id, or a NextResponse to return early
 * (401 unauthenticated / 403 not admin).
 *
 * getClaims() verifies the session JWT locally with asymmetric signing keys
 * (no extra Auth round-trip; the proxy already validated the session). The
 * role is read from `profiles` because the JWT's user_metadata.rol is
 * user-editable and must not be trusted. Admin RPCs re-check the role too.
 */
export async function requireGameAdmin(): Promise<
  { userId: string } | { response: NextResponse }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    return { response: NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', userId)
    .single();

  if (profile?.rol !== 'admin') {
    return { response: NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 }) };
  }

  return { userId };
}
