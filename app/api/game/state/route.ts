import { NextRequest, NextResponse } from 'next/server';
import { tenantConfig } from '@/config';
import { requireGamePlayer, rpcErrorResponse } from '@/lib/comunidad/player-guard';
import { isGameStatePart } from '@/lib/comunidad/game-state';

// GET ?parts=profile,daily_question,... : the requested sections of the game
// in ONE RPC (get_game_state). Used to refresh several screens at once (tab
// return, day change) instead of one request per query.
export async function GET(req: NextRequest) {
  const guard = await requireGamePlayer();
  if ('response' in guard) return guard.response;

  const raw = new URL(req.url).searchParams.get('parts') ?? '';
  const parts = [...new Set(raw.split(',').map((p) => p.trim()).filter(isGameStatePart))];
  if (parts.length === 0) {
    return NextResponse.json({ error: 'PARTS_REQUERIDAS' }, { status: 400 });
  }

  const { data, error } = await guard.supabase.rpc('get_game_state', {
    p_tenant: tenantConfig.id,
    p_parts: parts,
  });
  if (error) return rpcErrorResponse(error);

  return NextResponse.json(data);
}
