import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { quizStartSchema, type QuizStartResult } from '@/lib/comunidad/quiz';

// POST: start a quiz for a subject (optionally a category). Returns the
// selected active questions WITHOUT correctness. 400 when there are no
// active questions available for the subject.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = quizStartSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('start_quiz', {
    p_tenant: tenantConfig.id,
    p_subject_id: parsed.data.subject_id,
    p_category_id: parsed.data.category_id ?? null,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  const result = data as unknown as QuizStartResult;

  if (!result.ok) {
    const status = result.error_code === 'NO_QUESTIONS' ? 400 : 400;
    return NextResponse.json({ error: result.error_code ?? 'ERROR' }, { status });
  }

  return NextResponse.json(result);
}
