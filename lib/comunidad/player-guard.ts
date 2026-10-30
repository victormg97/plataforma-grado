import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Auth gate for the player game API routes.
 *
 * Uses getClaims() instead of getUser(): it verifies the session JWT and, with
 * asymmetric signing keys, does so locally (no extra Auth round-trip per
 * request; the proxy already validated the session). With legacy symmetric
 * keys supabase-js falls back to the Auth server, i.e. same cost as before.
 * Every game RPC re-checks auth.uid() and game access server-side.
 */
export async function requireGamePlayer(): Promise<
  | { supabase: SupabaseServerClient; userId: string }
  | { response: NextResponse }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) {
    return { response: NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 }) };
  }
  return { supabase, userId };
}

/** Maps a PostgREST error from a game RPC to a JSON response. */
export function rpcErrorResponse(error: { code?: string; message: string }) {
  const status = error.code === '42501' ? 403 : 500;
  return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
}
