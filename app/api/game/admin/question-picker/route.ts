import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';

// GET: paginated, filterable question picker for daily-question curation.
// Reuses the existing get_qb_questions RPC (server-side pagination + filters),
// scoped to active questions. Query params:
//   ?q= search, ?subject_id=, ?category_id=, ?type=, ?page=, ?page_size=
export async function GET(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || null;
  const subjectId = searchParams.get('subject_id') || null;
  const categoryId = searchParams.get('category_id') || null;
  const type = searchParams.get('type') || null;
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get('page_size')) || 10, 1), 50);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_qb_questions', {
    p_tenant: tenantConfig.id,
    p_search: q,
    p_category_id: categoryId,
    p_tag_ids: null,
    p_type: type,
    p_difficulty: null,
    p_status: 'active',
    p_date_from: null,
    p_date_to: null,
    p_subject_id: subjectId,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data);
}
