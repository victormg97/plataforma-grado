import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tenantConfig } from '@/config'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('referral_reward_rules')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
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
  
  const { data, error } = await supabase
    .from('referral_reward_rules')
    .insert({
      ...body,
      tenant: tenantConfig.id
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
