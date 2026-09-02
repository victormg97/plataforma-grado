import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { challengeSchema } from '@/lib/comunidad/admin';

// GET: list all challenges of the tenant.
export async function GET() {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_challenges')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST: create a challenge.
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = challengeSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'INVALID';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_challenges')
    .insert({
      tenant: tenantConfig.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      criteria: parsed.data.criteria,
      period_type: parsed.data.period_type,
      starts_at: parsed.data.starts_at ?? null,
      ends_at: parsed.data.ends_at ?? null,
      enabled: parsed.data.enabled,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT: update a challenge.
export async function PUT(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const id = body?.id;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'ID_REQUERIDO' }, { status: 400 });
  }

  const parsed = challengeSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'INVALID';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_challenges')
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      criteria: parsed.data.criteria,
      period_type: parsed.data.period_type,
      starts_at: parsed.data.starts_at ?? null,
      ends_at: parsed.data.ends_at ?? null,
      enabled: parsed.data.enabled,
    })
    .eq('id', id)
    .eq('tenant', tenantConfig.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: remove a challenge (?id=).
export async function DELETE(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID_REQUERIDO' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('game_challenges')
    .delete()
    .eq('id', id)
    .eq('tenant', tenantConfig.id);

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
