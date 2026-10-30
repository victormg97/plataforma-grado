import { NextRequest, NextResponse } from 'next/server';
import { requireGamePlayer } from '@/lib/comunidad/player-guard';
import { tenantConfig } from '@/config';
import type { UserBadgesResult } from '@/lib/comunidad/badge';

// GET: the caller's badge showcase (unlocked + locked for their audience).
export async function GET(_req: NextRequest) {
  const guard = await requireGamePlayer();
  if ('response' in guard) return guard.response;
  const { supabase } = guard;

  const { data, error } = await supabase.rpc('get_user_badges', {
    p_tenant: tenantConfig.id,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data as unknown as UserBadgesResult);
}
