import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';

// GET: any authenticated user reads the game settings for the current tenant.
// Returns fail-safe defaults (game disabled) if no row exists.
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data: settings, error } = await supabase
    .from('game_settings')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  if (!settings) {
    // Fail-safe: game disabled for this tenant.
    return NextResponse.json({
      tenant: tenantConfig.id,
      game_enabled: false,
      game_visibility: 'admin_only',
      display_name: 'Comunidad Estratégica',
      nickname_change_cooldown_days: 0,
      section_name_daily_question: 'Pregunta del Día',
      section_name_streak: 'Racha',
      section_name_ranking: 'Ranking',
      section_name_challenges: 'Desafíos',
      section_name_badges: 'Insignias',
      section_name_weekly_case: 'Caso Semanal',
      icon: 'trophy',
    });
  }

  return NextResponse.json(settings);
}

// PUT: admin updates the tenant-controlled fields. The platform-controlled
// flag (game_enabled) is stripped and never mutated here.
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  // Strip immutable / platform-controlled fields.
  const {
    id: _id,
    tenant: _tenant,
    created_at: _created_at,
    updated_at: _updated_at,
    game_enabled: _game_enabled,
    ...updateData
  } = body;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('game_settings')
    .upsert(
      { ...updateData, tenant: tenantConfig.id },
      { onConflict: 'tenant' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
