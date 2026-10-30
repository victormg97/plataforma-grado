import { NextResponse } from 'next/server';
import { requireGamePlayer } from '@/lib/comunidad/player-guard';
import { tenantConfig } from '@/config';

// GET: review of TODAY's already-answered daily question for the current user.
// Safe to expose correctness + explanation because the user already answered.
// Returns { answered: false } when the user hasn't answered today's question.
export async function GET() {
  const guard = await requireGamePlayer();
  if ('response' in guard) return guard.response;
  const { supabase } = guard;

  const { data, error } = await supabase.rpc('get_daily_review', {
    p_tenant: tenantConfig.id,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data);
}
