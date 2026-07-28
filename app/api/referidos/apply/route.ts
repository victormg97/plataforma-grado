import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tenantConfig } from '@/config'
import { calculateRewards } from '@/lib/referidos/rewardEngine'
import { isValidUserReferralCodeFormat, isValidDiscountCodeFormat } from '@/lib/referidos/codeGenerator'
import type { ReferralRewardRule } from '@/lib/referidos/types'

/**
 * POST /api/referidos/apply
 * Applies a referral code for a newly registered user.
 * Called internally from the registration route (fire-and-forget).
 * Uses a single DB stored procedure call + one update for rewards.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { referred_user_id, code, tenant } = body

    if (!referred_user_id || !code || tenant !== tenantConfig.id) {
      return NextResponse.json({ success: false, error: 'Parámetros inválidos' })
    }

    const normalizedCode = code.trim().toUpperCase()

    // Determine code type
    let codeType: 'user' | 'discount'
    if (isValidUserReferralCodeFormat(normalizedCode)) {
      codeType = 'user'
    } else if (isValidDiscountCodeFormat(normalizedCode)) {
      codeType = 'discount'
    } else {
      return NextResponse.json({ success: false, error: 'Formato de código inválido' })
    }

    const supabase = createAdminClient()

    // Single RPC call: validates code, checks duplicate, counts periods, inserts usage
    const { data: result, error: rpcError } = await supabase.rpc('apply_referral_code', {
      p_tenant: tenantConfig.id,
      p_referred_user_id: referred_user_id,
      p_code: normalizedCode,
      p_code_type: codeType,
    })

    if (rpcError) {
      return NextResponse.json({ success: false, error: rpcError.message })
    }

    if (!result?.success) {
      return NextResponse.json({ success: false, error: result?.error || 'Error desconocido' })
    }

    // Calculate rewards in app layer (pure function, no DB)
    const rules: ReferralRewardRule[] = (result.rules || []) as ReferralRewardRule[]
    const rewardsApplied = calculateRewards(rules, {
      isNewReferral: true,
      referrerMonthlyCount: result.referrer_monthly_count ?? 0,
      referrerWeeklyCount: result.referrer_weekly_count ?? 0,
      referrerQuarterlyCount: result.referrer_quarterly_count ?? 0,
    })

    // Update the usage row with calculated rewards (1 additional call)
    await supabase
      .from('referral_usages')
      .update({ rewards_applied: rewardsApplied })
      .eq('tenant', tenantConfig.id)
      .eq('referred_user_id', referred_user_id)

    return NextResponse.json({ success: true, rewards_applied: rewardsApplied })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg })
  }
}
