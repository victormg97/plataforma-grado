import { NextResponse } from 'next/server';
import { requireGamePlayer } from '@/lib/comunidad/player-guard';
import { tenantConfig } from '@/config';

// GET: single-round-trip bootstrap for the player game. Returns everything the
// game and its main tabs need (settings, profile, daily question, quiz
// subjects, ranking, challenges, badges, weekly case) via one orchestrator RPC.
// Used both by the server-side prefetch and as a client fallback.
export async function GET() {
  const guard = await requireGamePlayer();
  if ('response' in guard) return guard.response;
  const { supabase } = guard;

  const { data, error } = await supabase.rpc('get_game_bootstrap', {
    p_tenant: tenantConfig.id,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data);
}
