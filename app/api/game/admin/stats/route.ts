import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import type { GameStats } from '@/lib/comunidad/admin';

// GET: usage stats dashboard (Req. 15). Aggregation only; admin re-validated
// inside the RPC.
export async function GET() {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_game_stats', {
    p_tenant: tenantConfig.id,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data as unknown as GameStats);
}
