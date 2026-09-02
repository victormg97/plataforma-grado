import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { quizSubjectSettingSchema } from '@/lib/comunidad/admin';

// GET: subjects of the tenant + their per-subject quiz_question_count override.
export async function GET() {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const admin = createAdminClient();

  const { data: subjects, error } = await admin
    .from('qb_subjects')
    .select('id, name')
    .eq('tenant', tenantConfig.id)
    .order('name');

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });

  const { data: overrides } = await admin
    .from('game_quiz_subject_settings')
    .select('subject_id, quiz_question_count')
    .eq('tenant', tenantConfig.id);

  const map = new Map((overrides ?? []).map((o) => [o.subject_id, o.quiz_question_count]));

  return NextResponse.json(
    (subjects ?? []).map((s) => ({
      subject_id: s.id,
      name: s.name,
      quiz_question_count: map.get(s.id) ?? null,
    }))
  );
}

// PUT: set (or clear with null) the per-subject override.
export async function PUT(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));

  // Clearing an override: { subject_id, quiz_question_count: null }.
  if (body?.quiz_question_count === null && typeof body?.subject_id === 'string') {
    const admin = createAdminClient();
    const { error } = await admin
      .from('game_quiz_subject_settings')
      .delete()
      .eq('tenant', tenantConfig.id)
      .eq('subject_id', body.subject_id);
    if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const parsed = quizSubjectSettingSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'RANGO_INVALIDO';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_quiz_subject_settings')
    .upsert(
      {
        tenant: tenantConfig.id,
        subject_id: parsed.data.subject_id,
        quiz_question_count: parsed.data.quiz_question_count,
      },
      { onConflict: 'tenant,subject_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data);
}
