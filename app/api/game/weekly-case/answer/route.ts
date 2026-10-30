import { NextRequest, NextResponse } from 'next/server';
import { tenantConfig } from '@/config';
import { weeklyCaseAnswerSchema } from '@/lib/comunidad/weekly-case';
import { requireGamePlayer, rpcErrorResponse } from '@/lib/comunidad/player-guard';

// POST: submit or edit the caller's single answer to an open weekly case.
// game_submit_weekly_case runs submit_weekly_case_answer (participation event,
// streak, challenges, badges) and returns the refreshed game state in the same
// transaction, so the client needs no follow-up refetches.
export async function POST(req: NextRequest) {
  const guard = await requireGamePlayer();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = weeklyCaseAnswerSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'INVALID';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data, error } = await guard.supabase.rpc('game_submit_weekly_case', {
    p_tenant: tenantConfig.id,
    p_case_id: parsed.data.case_id,
    p_answer_content: parsed.data.answer_content,
  });
  if (error) return rpcErrorResponse(error);

  // The RPC returns { ok, error_code? }. Map business errors to HTTP status.
  const result = data as { ok?: boolean; error_code?: string };
  if (result && result.ok === false) {
    const code = result.error_code ?? 'ERROR';
    const status =
      code === 'EMPTY_ANSWER' ? 400
      : code === 'CASE_CLOSED' || code === 'CASE_NOT_AVAILABLE' ? 409
      : code === 'UNAUTHENTICATED' ? 401
      : 400;
    return NextResponse.json({ error: code }, { status });
  }

  return NextResponse.json(data);
}
