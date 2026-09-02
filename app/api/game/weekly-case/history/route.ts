import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';

// GET: navigable history of closed/resolved cases (newest first). When ?case=
// is provided, returns the detail of that single case (visibility-controlled).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get('case');

  if (caseId) {
    const { data, error } = await supabase.rpc('get_weekly_case_detail', {
      p_tenant: tenantConfig.id,
      p_case_id: caseId,
    });
    if (error) {
      const status = error.code === '42501' ? 403 : 500;
      return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
    }
    return NextResponse.json(data);
  }

  const limit = Number(searchParams.get('limit') ?? 20);
  const offset = Number(searchParams.get('offset') ?? 0);

  const { data, error } = await supabase.rpc('get_weekly_case_history', {
    p_tenant: tenantConfig.id,
    p_limit: Number.isFinite(limit) ? limit : 20,
    p_offset: Number.isFinite(offset) ? offset : 0,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data);
}
