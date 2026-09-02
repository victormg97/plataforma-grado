import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { nicknamePayloadSchema } from '@/lib/comunidad/nickname';

// GET: the caller's own game profile (nickname + streak). Returns null-ish
// defaults when the player has not been onboarded yet.
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  // Extended profile (nickname + streak + lives + level + recent achievements
  // + moderation) via the SECURITY DEFINER RPC, which also gates on
  // game_is_accessible and lazily regenerates lives.
  const { data, error } = await supabase.rpc('get_game_profile', {
    p_tenant: tenantConfig.id,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data);
}

// PUT: set / change the nickname through the SECURITY DEFINER RPC, which
// enforces validation, uniqueness and the change cooldown.
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = nicknamePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_FORMAT' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('upsert_game_nickname', {
    p_tenant: tenantConfig.id,
    p_nickname: parsed.data.nickname,
  });

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  // The RPC returns a structured JSONB result.
  const result = data as unknown as {
    ok: boolean;
    error_code?: string;
    nickname?: string;
    days_remaining?: number;
  };

  if (!result.ok) {
    // 409 for conflicts (taken / cooldown), 400 for format issues.
    const status = result.error_code === 'INVALID_FORMAT' ? 400 : 409;
    return NextResponse.json(
      { error: result.error_code ?? 'ERROR', days_remaining: result.days_remaining },
      { status }
    );
  }

  return NextResponse.json(result);
}
