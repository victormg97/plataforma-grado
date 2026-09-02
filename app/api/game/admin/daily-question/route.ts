import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { dailyCurateSchema } from '@/lib/comunidad/admin';

// GET: recent curated/assigned daily questions (?from=&to= optional).
export async function GET(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const admin = createAdminClient();
  let query = admin
    .from('game_daily_questions')
    .select('id, question_date, question_id, is_manually_curated')
    .eq('tenant', tenantConfig.id)
    .order('question_date', { ascending: false });

  if (from) query = query.gte('question_date', from);
  if (to) query = query.lte('question_date', to);

  const { data, error } = await query.limit(60);
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
    .select('id')
    .eq('id', parsed.data.question_id)
    .eq('tenant', tenantConfig.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!q) return NextResponse.json({ error: 'QUESTION_NOT_FOUND' }, { status: 400 });

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
