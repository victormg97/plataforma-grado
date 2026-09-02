import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { dailyCurateSchema } from '@/lib/comunidad/admin';

// GET: recent curated/assigned daily questions (?from=&to= optional).
// Enriches each row with the question content, type and subject name so the
// admin sees what actually ran on each date (not just the date).
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

  const { data: rows, error } = await query.limit(60);
  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });

  const list = rows ?? [];
  const questionIds = [...new Set(list.map((r) => r.question_id).filter(Boolean))] as string[];

  // Resolve question content + subject name in bulk.
  const questionMap = new Map<
    string,
    { content: string; type: string; subject_name: string | null }
  >();

  if (questionIds.length > 0) {
    const { data: questions } = await admin
      .from('qb_questions')
      .select('id, content, type, subject_id')
      .eq('tenant', tenantConfig.id)
      .in('id', questionIds);

    const subjectIds = [
      ...new Set((questions ?? []).map((q) => q.subject_id).filter(Boolean)),
    ] as string[];

    const subjectMap = new Map<string, string>();
    if (subjectIds.length > 0) {
      const { data: subjects } = await admin
        .from('qb_subjects')
        .select('id, name')
        .in('id', subjectIds);
      for (const s of subjects ?? []) subjectMap.set(s.id, s.name);
    }

    for (const q of questions ?? []) {
      questionMap.set(q.id, {
        content: q.content,
        type: q.type,
        subject_name: q.subject_id ? subjectMap.get(q.subject_id) ?? null : null,
      });
    }
  }

  const enriched = list.map((r) => {
    const q = r.question_id ? questionMap.get(r.question_id) : undefined;
    return {
      ...r,
      question_content: q?.content ?? null,
      question_type: q?.type ?? null,
      subject_name: q?.subject_name ?? null,
    };
  });

  return NextResponse.json(enriched);
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
