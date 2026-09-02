import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import {
  playerActionSchema,
  banPlayerSchema,
  setPlayerLivesSchema,
} from '@/lib/comunidad/game-config';

// GET: list game players (nickname, level, lives, moderation) with ?q= search.
export async function GET(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_game_players', {
    p_tenant: tenantConfig.id,
    p_search: q,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  // list_game_players already returns a JSON object shaped like { players: [...] }.
  // Be defensive: accept either that object or a bare array.
  const players = Array.isArray(data)
    ? data
    : (data as { players?: unknown } | null)?.players ?? [];

  return NextResponse.json({ players });
}

// POST: run a moderation action. Body: { action, ...payload }.
// Actions: restrict | unrestrict | ban | unban | set_lives | reset_level.
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string | undefined;
  const supabase = await createClient();

  let rpcName: string;
  let args: Record<string, unknown>;

  switch (action) {
    case 'restrict':
    case 'unrestrict':
    case 'reset_level': {
      const parsed = playerActionSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
      rpcName =
        action === 'restrict' ? 'restrict_player'
        : action === 'unrestrict' ? 'unrestrict_player'
        : 'reset_player_level';
      args = { p_tenant: tenantConfig.id, p_user_id: parsed.data.user_id };
      break;
    }
    case 'unban': {
      const parsed = playerActionSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
      rpcName = 'unban_player';
      args = { p_tenant: tenantConfig.id, p_user_id: parsed.data.user_id };
      break;
    }
    case 'ban': {
      const parsed = banPlayerSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
      rpcName = 'ban_player';
      args = { p_tenant: tenantConfig.id, p_user_id: parsed.data.user_id, p_reason: parsed.data.reason ?? null };
      break;
    }
    case 'set_lives': {
      const parsed = setPlayerLivesSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
      rpcName = 'set_player_lives';
      args = { p_tenant: tenantConfig.id, p_user_id: parsed.data.user_id, p_lives: parsed.data.lives };
      break;
    }
    default:
      return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc(rpcName as never, args as never);

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data);
}
