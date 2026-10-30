import { NextRequest, NextResponse } from 'next/server';
import { tenantConfig } from '@/config';
import { requireGamePlayer, rpcErrorResponse } from '@/lib/comunidad/player-guard';

// GET: monthly ranking page + the caller's own position, in ONE RPC
// (get_ranking_page). Query params: ?month=YYYY-MM (optional), ?limit, ?offset.
export async function GET(req: NextRequest) {
  const guard = await requireGamePlayer();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get('month'); // 'YYYY-MM' or null
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

  // 'YYYY-MM' → first day of month; anything else = current month.
  const pMonth = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? `${monthParam}-01` : undefined;

  const { data, error } = await guard.supabase.rpc('get_ranking_page', {
    p_tenant: tenantConfig.id,
    p_month: pMonth,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) return rpcErrorResponse(error);

  return NextResponse.json(data);
}
