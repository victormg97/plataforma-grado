import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { weeklyCaseSchema } from '@/lib/comunidad/weekly-case';

// GET: list all weekly cases of the tenant (with participant count).
export async function GET() {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_weekly_cases')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .order('window_start', { ascending: false });

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST: create a weekly case (draft or open). resolution_content is not set
// here; it is published later via the resolution route.
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = weeklyCaseSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'INVALID';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_weekly_cases')
    .insert({
      tenant: tenantConfig.id,
      title: parsed.data.title,
      content: parsed.data.content,
      window_start: parsed.data.window_start,
      window_end: parsed.data.window_end,
      status: parsed.data.status,
      resolution_visibility: parsed.data.resolution_visibility,
      created_by: guard.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT: update a weekly case. Does not touch resolution_content / status
// beyond draft|open (resolution is published via its own route).
export async function PUT(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const id = body?.id;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'ID_REQUERIDO' }, { status: 400 });
  }

  const parsed = weeklyCaseSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'INVALID';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('game_weekly_cases')
    .update({
      title: parsed.data.title,
      content: parsed.data.content,
      window_start: parsed.data.window_start,
      window_end: parsed.data.window_end,
      status: parsed.data.status,
      resolution_visibility: parsed.data.resolution_visibility,
    })
    .eq('id', id)
    .eq('tenant', tenantConfig.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: remove a weekly case (?id=). Answers cascade via the FK.
export async function DELETE(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID_REQUERIDO' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('game_weekly_cases')
    .delete()
    .eq('id', id)
    .eq('tenant', tenantConfig.id);

  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
