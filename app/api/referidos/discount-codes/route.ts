import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tenantConfig } from '@/config'
import { generateDiscountCode, isValidDiscountCodeFormat } from '@/lib/referidos/codeGenerator'

export async function GET(_req: NextRequest) {
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

  const { data, error } = await supabase
    .from('discount_codes')
    .select(`
      *,
      referral_usages (count)
    `)
    .eq('tenant', tenantConfig.id)

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 })
  }

  const formattedData = data.map((d: Record<string, unknown>) => ({
    ...d,
    usage_count: (d.referral_usages as { count: number }[])?.[0]?.count || 0
  }))

  return NextResponse.json(formattedData)
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
  const { auto_generate, start_date, end_date, is_active, reward_rule_id } = body
  let { code } = body

  if (auto_generate) {
    const { data: existing } = await supabase
      .from('discount_codes')
      .select('code')
      .eq('tenant', tenantConfig.id)
    
    const existingSet = new Set((existing || []).map(r => r.code))
    try {
      code = generateDiscountCode(existingSet)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      return NextResponse.json({ error: 'GENERATION_ERROR', message }, { status: 500 })
    }
  } else {
    if (!code) {
      return NextResponse.json({ error: 'VALIDACION', message: 'Código es requerido' }, { status: 400 })
    }
    code = code.trim().toUpperCase()
    if (!isValidDiscountCodeFormat(code)) {
      return NextResponse.json({ error: 'VALIDACION', message: 'Formato de código inválido' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('discount_codes')
    .insert({
      tenant: tenantConfig.id,
      code,
      start_date,
      end_date,
      is_active: is_active ?? true,
      reward_rule_id,
      created_by: user.id
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
