import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { dailyAnswerSchema, type DailyAnswerResult } from '@/lib/comunidad/answer';

// POST: submit an answer to today's daily question. The RPC evaluates
// correctness, awards points, updates the streak and records the event
// atomically (idempotent per user/day).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = dailyAnswerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_ANSWER' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('answer_daily_question', {
    p_tenant: tenantConfig.id,
    p_answer: parsed.data,
  });

  if (error) {
    // Access denied (42501) or other DB error.
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  const result = data as unknown as DailyAnswerResult;

  if (!result.ok) {
    const status = result.error_code === 'NO_DAILY_QUESTION' ? 404 : 400;
    return NextResponse.json({ error: result.error_code ?? 'ERROR' }, { status });
  }

  return NextResponse.json(result);
}
