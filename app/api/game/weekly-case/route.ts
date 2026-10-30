import { NextRequest, NextResponse } from 'next/server';
import { requireGamePlayer } from '@/lib/comunidad/player-guard';
import { tenantConfig } from '@/config';

// GET: current (or latest visible) weekly case for the player, with the
// caller's answer and the resolution (only if published and visible).
export async function GET(_req: NextRequest) {
  const guard = await requireGamePlayer();
  if ('response' in guard) return guard.response;
  const { supabase } = guard;

  const { data, error } = await supabase.rpc('get_current_weekly_case', {
    p_tenant: tenantConfig.id,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data);
}
