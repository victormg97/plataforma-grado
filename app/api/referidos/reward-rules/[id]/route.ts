import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tenantConfig } from '@/config'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const { id } = await params

  const { data, error } = await supabase
    .from('referral_reward_rules')
    .update(body)
    .eq('id', id)
    .eq('tenant', tenantConfig.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  
  const { id } = await params

  const { error } = await supabase
    .from('referral_reward_rules')
    .update({ is_active: false })
    .eq('id', id)
    .eq('tenant', tenantConfig.id)

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
