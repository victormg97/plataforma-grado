import { NextRequest, NextResponse } from 'next/server';
import { tenantConfig } from '@/config';
import { quizSubmitSchema, type QuizSubmitResult } from '@/lib/comunidad/quiz';
import { requireGamePlayer, rpcErrorResponse } from '@/lib/comunidad/player-guard';

// POST: submit quiz answers. game_submit_quiz runs submit_quiz (re-evaluates
// correctness, scores, records the event, streak, challenges, badges) and
// returns the per-question review plus the refreshed game state, all in one
// transaction / one round-trip.
export async function POST(req: NextRequest) {
  const guard = await requireGamePlayer();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = quizSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_ANSWERS' }, { status: 400 });
  }

  const { data, error } = await guard.supabase.rpc('game_submit_quiz', {
    p_tenant: tenantConfig.id,
    p_subject_id: parsed.data.subject_id,
    p_category_id: parsed.data.category_id ?? null,
    p_answers: parsed.data.answers,
    p_attempt_id: parsed.data.attempt_id ?? null,
  });
  if (error) return rpcErrorResponse(error);

  const result = data as unknown as QuizSubmitResult;
  if (!result.ok) {
    return NextResponse.json({ error: result.error_code ?? 'ERROR' }, { status: 400 });
  }

  return NextResponse.json(result);
}
