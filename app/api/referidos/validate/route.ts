import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tenantConfig } from '@/config'
import { isValidUserReferralCodeFormat, isValidDiscountCodeFormat } from '@/lib/referidos/codeGenerator'

/**
 * POST /api/referidos/validate
 * Validates a referral or discount code during registration.
 * Public endpoint (no auth required) — called from the registration form.
 * Rate limiting is handled at the Vercel/edge level or by Upstash if configured.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  let { code } = body

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ valid: false, message: 'Código inválido' })
  }

  code = code.trim().toUpperCase()

  const isUserCode = isValidUserReferralCodeFormat(code)
  const isDiscountCode = isValidDiscountCodeFormat(code)

  if (!isUserCode && !isDiscountCode) {
    return NextResponse.json({ valid: false, message: 'Código inválido' })
  }

  const supabase = await createClient()

  // Single query to check settings + validate code
  const { data: settings } = await supabase
    .from('referral_settings')
    .select('platform_enabled, tenant_enabled')
    .eq('tenant', tenantConfig.id)
    .maybeSingle()

  if (!settings?.platform_enabled || !settings?.tenant_enabled) {
    return NextResponse.json({ valid: false, message: 'El sistema de referidos no está disponible en este momento' })
  }

  if (isUserCode) {
    const { data } = await supabase
      .from('user_referral_codes')
      .select('id')
      .eq('code', code)
      .eq('tenant', tenantConfig.id)
      .maybeSingle()

    if (data) {
      return NextResponse.json({ valid: true, type: 'user' })
    }
  } else {
    const { data } = await supabase
      .from('discount_codes')
      .select('id, start_date, end_date, is_active, manual_override')
      .eq('code', code)
      .eq('tenant', tenantConfig.id)
      .maybeSingle()

    if (data) {
      const active = data.manual_override !== null
        ? data.manual_override
        : data.is_active &&
          (!data.start_date || new Date(data.start_date) <= new Date()) &&
          (!data.end_date || new Date(data.end_date) >= new Date())

      if (active) {
        return NextResponse.json({ valid: true, type: 'discount' })
      }
    }
  }

  return NextResponse.json({ valid: false, message: 'Código inválido o expirado' })
}
