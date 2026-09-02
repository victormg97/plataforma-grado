import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { quizSubmitSchema, type QuizSubmitResult } from '@/lib/comunidad/quiz';

// POST: submit quiz answers. The RPC re-evaluates correctness, scores per the
// configured scoring_mode, records the quiz_completed event with subject/
// category refs, updates the streak (if the source counts) and evaluates
// challenges — all atomically.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = quizSubmitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_ANSWERS' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('submit_quiz', {
    p_tenant: tenantConfig.id,
    p_subject_id: parsed.data.subject_id,
    p_category_id: parsed.data.category_id ?? null,
    p_answers: parsed.data.answers,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  const result = data as unknown as QuizSubmitResult;

  if (!result.ok) {
    const status = result.error_code === 'NO_QUESTIONS' ? 400 : 400;
    return NextResponse.json({ error: result.error_code ?? 'ERROR' }, { status });
  }

  return NextResponse.json(result);
}
