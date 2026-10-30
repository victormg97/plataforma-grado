import { NextResponse } from 'next/server';
import { tenantConfig } from '@/config';
import { requireGamePlayer, rpcErrorResponse } from '@/lib/comunidad/player-guard';

// GET: today's daily question (options WITHOUT correctness) + whether the
// caller already answered it. One RPC (get_daily_question_state); before this
// route made three DB calls (select RPC + question select + answered count).
export async function GET() {
  const guard = await requireGamePlayer();
  if ('response' in guard) return guard.response;

  const { data, error } = await guard.supabase.rpc('get_daily_question_state', {
    p_tenant: tenantConfig.id,
  });
  if (error) return rpcErrorResponse(error);

  return NextResponse.json(data ?? { question: null, already_answered: false });
}
