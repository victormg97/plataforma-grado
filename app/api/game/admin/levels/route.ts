import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { levelThresholdsSchema } from '@/lib/comunidad/game-config';

// GET: list level thresholds (level ascending).
export async function GET() {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_level_thresholds')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .order('level');

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// PUT: replace the full set of level thresholds for the tenant. Level 1 with
// min_points 0 is enforced so a base level always exists.
export async function PUT(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = levelThresholdsSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'RANGO_INVALIDO';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Normalize: unique by level, ensure level 1 = 0 points, sorted.
  const byLevel = new Map<number, { level: number; min_points: number; label: string | null }>();
  for (const l of parsed.data.levels) {
    byLevel.set(l.level, { level: l.level, min_points: l.min_points, label: l.label ?? null });
  }
  if (!byLevel.has(1)) {
    byLevel.set(1, { level: 1, min_points: 0, label: null });
  } else {
    const one = byLevel.get(1)!;
    byLevel.set(1, { ...one, min_points: 0 });
  }
  const levels = Array.from(byLevel.values()).sort((a, b) => a.level - b.level);

  const admin = createAdminClient();

  // Replace the whole set for this tenant.
  const { error: delError } = await admin
    .from('game_level_thresholds')
    .delete()
    .eq('tenant', tenantConfig.id);
  if (delError) return NextResponse.json({ error: 'ERROR_DB', message: delError.message }, { status: 500 });

  const { error: insError } = await admin
    .from('game_level_thresholds')
    .insert(levels.map((l) => ({ tenant: tenantConfig.id, ...l })));
  if (insError) return NextResponse.json({ error: 'ERROR_DB', message: insError.message }, { status: 500 });

  const { data } = await admin
    .from('game_level_thresholds')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .order('level');

  return NextResponse.json(data ?? []);
}
