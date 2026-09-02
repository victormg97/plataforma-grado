import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { scoreResetSchema } from '@/lib/comunidad/admin';

// GET: recent reset audit log (Req. 16 danger zone history).
export async function GET() {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_score_reset_log')
    .select('id, executed_by, executed_at, reset_scope')
    .eq('tenant', tenantConfig.id)
    .order('executed_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST: execute a non-destructive score reset (Req. 16/17). The RPC re-validates
// admin and the exact confirmation text (= tenant id).
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = scoreResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('reset_game_scores', {
    p_tenant: tenantConfig.id,
    p_scope: parsed.data.scope,
    p_confirmation: parsed.data.confirmation,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  const result = data as { ok: boolean; error_code?: string };
  if (!result.ok) {
    return NextResponse.json({ error: result.error_code ?? 'ERROR' }, { status: 400 });
  }

  return NextResponse.json(result);
}
