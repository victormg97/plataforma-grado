import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { streakThresholdsSchema } from '@/lib/comunidad/admin';

// GET: list streak thresholds (days ascending).
export async function GET() {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_streak_thresholds')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .order('days');

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// PUT: replace the full set of thresholds for the tenant (idempotent).
export async function PUT(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = streakThresholdsSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'RANGO_INVALIDO';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();
  const unique = Array.from(new Set(parsed.data.days)).sort((a, b) => a - b);

  // Delete removed thresholds, then upsert the desired set.
  const { error: delError } = await admin
    .from('game_streak_thresholds')
    .delete()
    .eq('tenant', tenantConfig.id)
    .not('days', 'in', `(${unique.join(',') || '0'})`);

  if (delError) return NextResponse.json({ error: 'ERROR_DB', message: delError.message }, { status: 500 });

  if (unique.length > 0) {
    const { error: upError } = await admin
      .from('game_streak_thresholds')
      .upsert(
        unique.map((days) => ({ tenant: tenantConfig.id, days })),
        { onConflict: 'tenant,days' }
      );
    if (upError) return NextResponse.json({ error: 'ERROR_DB', message: upError.message }, { status: 500 });
  }

  const { data } = await admin
    .from('game_streak_thresholds')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .order('days');

  return NextResponse.json(data ?? []);
}
