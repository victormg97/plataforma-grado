import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { weeklyCaseAnswerSchema } from '@/lib/comunidad/weekly-case';

// POST: submit or edit the caller's single answer to an open weekly case.
// The RPC emits weekly_case_participated once per (user, case) and wires
// streak/challenges/badges within the same transaction.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = weeklyCaseAnswerSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'INVALID';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('submit_weekly_case_answer', {
    p_tenant: tenantConfig.id,
    p_case_id: parsed.data.case_id,
    p_answer_content: parsed.data.answer_content,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

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
