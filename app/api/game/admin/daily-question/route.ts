import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { dailyCurateSchema } from '@/lib/comunidad/admin';

const DAILY_SUPPORTED_TYPES: string[] = ['single_choice', 'multiple_choice', 'true_false'];

// GET: recent curated/assigned daily questions (?from=&to= optional),
// enriched with the question content, type and subject name. One RPC with
// joins (before: three sequential queries + merging here).
export async function GET(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const isDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_list_daily_questions', {
    p_tenant: tenantConfig.id,
    p_from: isDate(searchParams.get('from')),
    p_to: isDate(searchParams.get('to')),
  });

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// PUT: manually curate the question for a given date (Req. 13).
export async function PUT(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = dailyCurateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'INVALID';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();

  // The question must belong to the tenant and be active.
  const { data: q } = await admin
    .from('qb_questions')
    .select('id, type')
    .eq('id', parsed.data.question_id)
    .eq('tenant', tenantConfig.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!q) return NextResponse.json({ error: 'QUESTION_NOT_FOUND' }, { status: 400 });

  // The Pregunta del Día only supports choice and true/false questions
  // (answer_daily_question can't grade matching / fill_blank / open_ended).
  if (!DAILY_SUPPORTED_TYPES.includes(q.type)) {
    return NextResponse.json({ error: 'UNSUPPORTED_TYPE' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('game_daily_questions')
    .upsert(
      {
        tenant: tenantConfig.id,
        question_date: parsed.data.question_date,
        question_id: parsed.data.question_id,
        is_manually_curated: true,
      },
      { onConflict: 'tenant,question_date' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data);
}
