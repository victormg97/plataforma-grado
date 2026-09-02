import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side guard for the Comunidad Estratégica admin API routes.
 * Returns the authenticated admin user id, or a NextResponse to return early
 * (401 unauthenticated / 403 not admin). Mirrors the pattern of the existing
 * PUT /api/game/settings route.
 */
export async function requireGameAdmin(): Promise<
  { userId: string } | { response: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return { response: NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 }) };
  }

  return { userId: user.id };
}
