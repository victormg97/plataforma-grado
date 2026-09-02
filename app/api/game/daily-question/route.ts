import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';

// GET: returns today's daily question for the current tenant. Options are
// returned WITHOUT the is_correct flags (the correct answer is never sent to
// the client before answering). Also reports whether the caller already
// answered today.
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  // Resolve (lazily select) today's question id. RPC also enforces access.
  const { data: questionId, error: selErr } = await supabase.rpc('select_daily_question', {
    p_tenant: tenantConfig.id,
  });

  if (selErr) {
    // Access denied surfaces as a Postgres error (42501) via the RPC.
    return NextResponse.json({ error: 'PROHIBIDO', message: selErr.message }, { status: 403 });
  }

  if (!questionId) {
    // No active question available — not an error.
    return NextResponse.json({ question: null, already_answered: false });
  }

  const { data: question, error: qErr } = await supabase
    .from('qb_questions')
    .select('id, type, content, options')
    .eq('id', questionId)
    .single();

  if (qErr || !question) {
    return NextResponse.json({ question: null, already_answered: false });
  }

  // Strip correctness info from the options before returning.
  const safeOptions = sanitizeOptions(question.type, question.options);

  // Has the caller already answered today's question?
  const { count } = await supabase
    .from('game_point_events')
    .select('id', { count: 'exact', head: true })
    .eq('tenant', tenantConfig.id)
    .eq('user_id', user.id)
    .eq('action_type', 'daily_question_answered')
    .eq('source_ref', questionId);

  return NextResponse.json({
    question: {
      id: question.id,
      type: question.type,
      content: question.content,
      options: safeOptions,
    },
    already_answered: (count ?? 0) > 0,
  });
}

// Removes is_correct / correct_answer so the client cannot see the solution
// before submitting an answer.
function sanitizeOptions(type: string, options: unknown): unknown {
  if (type === 'single_choice' || type === 'multiple_choice') {
    if (Array.isArray(options)) {
      return options.map((opt) => {
        const o = (opt ?? {}) as Record<string, unknown>;
        return { text: o.text ?? '' };
      });
    }
    return [];
  }
  if (type === 'true_false') {
    // No option data needed; the client shows fixed true/false controls.
    return {};
  }
  return options;
}
