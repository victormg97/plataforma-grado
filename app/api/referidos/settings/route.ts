import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tenantConfig } from '@/config'
import type { ReferralSettings } from '@/lib/referidos/types'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 })
  }

  const { data: settings, error } = await supabase
    .from('referral_settings')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 })
  }

  if (!settings) {
    const defaultSettings: Partial<ReferralSettings> = {
      tenant: tenantConfig.id,
      platform_enabled: false,
      tenant_enabled: false,
      display_name: 'Sistema de Referidos',
      icon: 'star',
      reader_role_enabled: true,
      discount_codes_module_enabled: false,
      discount_codes_display_name: 'Código de Descuento',
      show_rewards_to_user: true,
      show_referral_count_to_user: true,
    }
    return NextResponse.json(defaultSettings)
  }

  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  
  const { id: _id, tenant: _tenant, created_at: _created_at, platform_enabled: _platform_enabled, ...updateData } = body

  const { data, error } = await supabase
    .from('referral_settings')
    .update(updateData)
    .eq('tenant', tenantConfig.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
