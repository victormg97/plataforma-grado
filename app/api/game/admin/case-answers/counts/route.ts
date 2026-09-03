import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';

// GET: pending (ungraded) weekly-case answer counts for the review badges.
// Returns { total, by_case: { [caseId]: n }, by_user: { [userId]: n } }.
export async function GET() {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_weekly_case_pending_counts', {
    p_tenant: tenantConfig.id,
  });

  if (error) {
    const s = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status: s });
  }

  return NextResponse.json(data);
}
