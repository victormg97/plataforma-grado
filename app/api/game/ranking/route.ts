import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import type { MonthlyRankingResult, MyRankingPosition } from '@/lib/comunidad/quiz';

// GET: monthly ranking (paginated) combined with the caller's own position.
// Query params: ?month=YYYY-MM (optional), ?limit, ?offset.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get('month'); // 'YYYY-MM' or null
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

  // Convert 'YYYY-MM' to a DATE (first of month) the RPC accepts; null = current.
  const pMonth = monthParam ? `${monthParam}-01` : undefined;

  const [rankingRes, positionRes] = await Promise.all([
    supabase.rpc('get_monthly_ranking', {
      p_tenant: tenantConfig.id,
      p_month: pMonth,
      p_limit: limit,
      p_offset: offset,
    }),
    supabase.rpc('get_my_ranking_position', {
      p_tenant: tenantConfig.id,
      p_month: pMonth,
    }),
  ]);

  if (rankingRes.error) {
    const status = rankingRes.error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: rankingRes.error.message }, { status });
  }

  const ranking = rankingRes.data as unknown as MonthlyRankingResult;
  const myPosition = (positionRes.data as unknown as MyRankingPosition) ?? { has_position: false };

  return NextResponse.json({ ...ranking, my_position: myPosition });
}
