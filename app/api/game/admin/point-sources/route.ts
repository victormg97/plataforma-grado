import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { pointSourceSchema } from '@/lib/comunidad/admin';

// GET: list point sources for the tenant.
export async function GET() {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_point_sources')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .order('action_type');

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// PUT: upsert one point source (points_value, enabled, counts_for_streak).
export async function PUT(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = pointSourceSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'INVALID';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_point_sources')
    .update({
      points_value: parsed.data.points_value,
      enabled: parsed.data.enabled,
      counts_for_streak: parsed.data.counts_for_streak,
    })
    .eq('tenant', tenantConfig.id)
    .eq('action_type', parsed.data.action_type)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data);
}
