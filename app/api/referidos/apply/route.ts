import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { tenantConfig } from '@/config'
import { calculateRewards } from '@/lib/referidos/rewardEngine'
import { isValidUserReferralCodeFormat, isValidDiscountCodeFormat } from '@/lib/referidos/codeGenerator'

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
       return NextResponse.json({ success: false, error: 'Configuración de servidor incompleta' })
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json().catch(() => ({}))
    const { referred_user_id, code, tenant } = body

    if (!referred_user_id || !code || tenant !== tenantConfig.id) {
      return NextResponse.json({ success: false, error: 'Parámetros inválidos' })
    }

    const normalizedCode = code.trim().toUpperCase()
    
    let user_referral_code_id: string | null = null
    let discount_code_id: string | null = null

    if (isValidUserReferralCodeFormat(normalizedCode)) {
      const { data } = await supabase
        .from('user_referral_codes')
        .select('id, user_id')
        .eq('code', normalizedCode)
        .eq('tenant', tenantConfig.id)
        .single()
        
      if (!data) return NextResponse.json({ success: false, error: 'Código no encontrado' })
      user_referral_code_id = data.id
    } else if (isValidDiscountCodeFormat(normalizedCode)) {
      const { data } = await supabase
        .from('discount_codes')
        .select('id, start_date, end_date, is_active, manual_override')
        .eq('code', normalizedCode)
        .eq('tenant', tenantConfig.id)
        .single()
        
      if (!data) return NextResponse.json({ success: false, error: 'Código no encontrado' })
      
      const active = data.manual_override !== null 
        ? data.manual_override 
        : data.is_active && 
          (!data.start_date || new Date(data.start_date) <= new Date()) && 
          (!data.end_date || new Date(data.end_date) >= new Date())
          
      if (!active) return NextResponse.json({ success: false, error: 'Código expirado' })
      discount_code_id = data.id
    } else {
      return NextResponse.json({ success: false, error: 'Formato de código inválido' })
    }

    const { data: rules } = await supabase
      .from('referral_reward_rules')
      .select('*')
      .eq('tenant', tenantConfig.id)
      .eq('is_active', true)
      
    let referrerMonthlyCount = 0
    
    if (user_referral_code_id) {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      
      const { count } = await supabase
        .from('referral_usages')
        .select('*', { count: 'exact', head: true })
        .eq('user_referral_code_id', user_referral_code_id)
        .eq('tenant', tenantConfig.id)
        .gte('used_at', startOfMonth)
        
      referrerMonthlyCount = count || 0
    }

    const context = {
      isNewReferral: true,
      referrerMonthlyCount,
      referrerWeeklyCount: 0,
      referrerQuarterlyCount: 0
    }

    const rewardsApplied = calculateRewards(rules || [], context)

    const { error: insertError } = await supabase
      .from('referral_usages')
      .insert({
        tenant: tenantConfig.id,
        referred_user_id,
        user_referral_code_id,
        discount_code_id,
        used_at: new Date().toISOString(),
        rewards_applied: rewardsApplied
      })

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message })
    }

    return NextResponse.json({ success: true, rewards_applied: rewardsApplied })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg })
  }
}
