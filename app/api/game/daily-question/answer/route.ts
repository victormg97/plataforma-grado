import { NextRequest, NextResponse } from 'next/server';
import { tenantConfig } from '@/config';
import { dailyAnswerSchema, type DailyAnswerResult } from '@/lib/comunidad/answer';
import { requireGamePlayer, rpcErrorResponse } from '@/lib/comunidad/player-guard';

// POST: submit an answer to today's daily question. game_answer_daily runs
// answer_daily_question (correctness, points, streak, idempotent per day) and
// returns the refreshed game state in the SAME transaction, so the client
// updates profile/review/badges/challenges/ranking without extra requests.
export async function POST(req: NextRequest) {
  const guard = await requireGamePlayer();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = dailyAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_ANSWER' }, { status: 400 });
  }

  const { data, error } = await guard.supabase.rpc('game_answer_daily', {
    p_tenant: tenantConfig.id,
    p_answer: parsed.data,
  });
  if (error) return rpcErrorResponse(error);

  const result = data as unknown as DailyAnswerResult;
  if (!result.ok) {
    const status = result.error_code === 'NO_DAILY_QUESTION' ? 404 : 400;
    return NextResponse.json({ error: result.error_code ?? 'ERROR' }, { status });
  }

  return NextResponse.json(result);
}
