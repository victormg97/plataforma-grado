import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { badgeGrantSchema } from '@/lib/comunidad/badge';

// POST: manually grant a badge to a user (Req. 5). The RPC re-validates admin.
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = badgeGrantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('grant_badge_manual', {
    p_tenant: tenantConfig.id,
    p_badge_id: parsed.data.badge_id,
    p_user_id: parsed.data.user_id,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  const result = data as { ok: boolean; error_code?: string };
  if (!result.ok) {
    const status = result.error_code === 'ALREADY_OWNED' ? 409 : 400;
    return NextResponse.json({ error: result.error_code ?? 'ERROR' }, { status });
  }

  return NextResponse.json(result);
}
