import { NextRequest, NextResponse } from 'next/server';
import { requireGamePlayer } from '@/lib/comunidad/player-guard';
import { tenantConfig } from '@/config';

// GET: active challenges (vigency includes now, America/Santiago) with the
// caller's progress and completed flag.
export async function GET(_req: NextRequest) {
  const guard = await requireGamePlayer();
  if ('response' in guard) return guard.response;
  const { supabase } = guard;

  const { data, error } = await supabase.rpc('get_active_challenges', {
    p_tenant: tenantConfig.id,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data);
}
