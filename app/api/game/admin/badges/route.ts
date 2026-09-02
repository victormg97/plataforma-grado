import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { badgeSchema, type AdminBadge } from '@/lib/comunidad/badge';

// GET: list all badges of the tenant with a grant count (for delete warnings).
export async function GET(_req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const admin = createAdminClient();

  const { data: badges, error } = await admin
    .from('game_badges')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .order('series_key', { ascending: true, nullsFirst: false })
    .order('series_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  // Grant counts per badge.
  const { data: counts } = await admin
    .from('user_badges')
    .select('badge_id')
    .eq('tenant', tenantConfig.id);

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    countMap.set(row.badge_id, (countMap.get(row.badge_id) ?? 0) + 1);
  }

  const result: AdminBadge[] = (badges ?? []).map((b) => ({
    ...(b as unknown as AdminBadge),
    grant_count: countMap.get(b.id) ?? 0,
  }));

  return NextResponse.json(result);
}

// POST: create a badge. Automatic badges trigger a retroactive backfill.
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = badgeSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'INVALID';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_badges')
    .insert({
      tenant: tenantConfig.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      image_path: parsed.data.image_path ?? null,
      audience: parsed.data.audience,
      unlock_type: parsed.data.unlock_type,
      criteria: parsed.data.criteria ?? null,
      series_key: parsed.data.series_key ?? null,
      series_order: parsed.data.series_order ?? null,
      hide_criteria: parsed.data.hide_criteria,
      enabled: parsed.data.enabled,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  // Retroactive grants for automatic + enabled badges (Req. 4).
  if (data.unlock_type === 'automatic' && data.enabled) {
    await backfill(data.id);
  }

  return NextResponse.json(data);
}

// PUT: update a badge. Automatic + enabled → backfill after saving.
export async function PUT(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const id = body?.id;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'ID_REQUERIDO' }, { status: 400 });
  }

  const parsed = badgeSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'INVALID';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_badges')
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      image_path: parsed.data.image_path ?? null,
      audience: parsed.data.audience,
      unlock_type: parsed.data.unlock_type,
      criteria: parsed.data.criteria ?? null,
      series_key: parsed.data.series_key ?? null,
      series_order: parsed.data.series_order ?? null,
      hide_criteria: parsed.data.hide_criteria,
      enabled: parsed.data.enabled,
    })
    .eq('id', id)
    .eq('tenant', tenantConfig.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  if (data.unlock_type === 'automatic' && data.enabled) {
    await backfill(data.id);
  }

  return NextResponse.json(data);
}

// DELETE: safe delete. Query ?id=&force=true. Uses delete_badge RPC so the
// admin role is re-validated and grants are handled (soft vs hard delete).
export async function DELETE(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const force = searchParams.get('force') === 'true';
  if (!id) {
    return NextResponse.json({ error: 'ID_REQUERIDO' }, { status: 400 });
  }

  // Uses the caller's session so get_current_user_rol() resolves to admin.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('delete_badge', {
    p_tenant: tenantConfig.id,
    p_badge_id: id,
    p_force: force,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  const result = data as { ok: boolean; error_code?: string; affected_count?: number; deleted?: string };
  if (!result.ok && result.error_code === 'HAS_GRANTS') {
    return NextResponse.json({ error: 'HAS_GRANTS', affected_count: result.affected_count }, { status: 409 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error_code ?? 'ERROR' }, { status: 400 });
  }

  return NextResponse.json(result);
}

// Runs the retroactive backfill via the caller's session (admin RLS context).
async function backfill(badgeId: string) {
  const supabase = await createClient();
  await supabase.rpc('backfill_badge', {
    p_tenant: tenantConfig.id,
    p_badge_id: badgeId,
  });
}
