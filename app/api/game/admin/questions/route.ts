import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';

// GET: active questions of the tenant for the daily-question curation picker.
// Optional ?q= filters by content; optional ?subject_id= filters by subject.
export async function GET(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const subjectId = searchParams.get('subject_id')?.trim();

  const admin = createAdminClient();
  let query = admin
    .from('qb_questions')
    .select('id, content, type, subject_id, category_id')
    .eq('tenant', tenantConfig.id)
    .eq('status', 'active')
    .order('content')
    .limit(50);

  if (subjectId) query = query.eq('subject_id', subjectId);
  if (q) query = query.ilike('content', `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });

  const list = data ?? [];
  const subjectIds = [...new Set(list.map((r) => r.subject_id).filter(Boolean))] as string[];
  const subjectMap = new Map<string, string>();
  if (subjectIds.length > 0) {
    const { data: subjects } = await admin
      .from('qb_subjects')
      .select('id, name')
      .in('id', subjectIds);
    for (const s of subjects ?? []) subjectMap.set(s.id, s.name);
  }

  const enriched = list.map((r) => ({
    ...r,
    subject_name: r.subject_id ? subjectMap.get(r.subject_id) ?? null : null,
  }));

  return NextResponse.json(enriched);
}
