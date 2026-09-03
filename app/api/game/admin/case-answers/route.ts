import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';

// GET: paginated list of weekly-case answers for review.
// Query: ?case_id=&user_id=&status=pending|graded&page=&page_size=
export async function GET(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get('case_id') || null;
  const userId = searchParams.get('user_id') || null;
  const status = searchParams.get('status') || null; // 'pending' | 'graded' | null
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get('page_size')) || 10, 1), 50);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_weekly_case_answers', {
    p_tenant: tenantConfig.id,
    p_case_id: caseId,
    p_user_id: userId,
    p_status: status,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    const s = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status: s });
  }

  return NextResponse.json(data);
}
