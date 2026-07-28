import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tenantConfig } from '@/config'

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

  const isAdmin = profile?.rol === 'admin'

  // Build query based on role
  let query = supabase
    .from('referral_usages')
    .select(`
      id,
      tenant,
      referred_user_id,
      user_referral_code_id,
      discount_code_id,
      used_at,
      rewards_applied
    `)
    .eq('tenant', tenantConfig.id)
    .order('used_at', { ascending: false })

  // Non-admin: get usages where MY referral code was used (people I referred)
  if (!isAdmin) {
    // First, get the current user's referral code ID
    const { data: myCode } = await supabase
      .from('user_referral_codes')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant', tenantConfig.id)
      .maybeSingle()

    if (!myCode) {
      return NextResponse.json([])
    }

    query = query.eq('user_referral_code_id', myCode.id)
  }

  const { data: usages, error } = await query

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 })
  }

  if (!usages || usages.length === 0) {
    return NextResponse.json([])
  }

  // Enrich with referred user profiles
  const referredUserIds = [...new Set(usages.map((u) => u.referred_user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, email, rol')
    .in('id', referredUserIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  // Enrich with user referral codes
  const userCodeIds = usages
    .filter((u) => u.user_referral_code_id)
    .map((u) => u.user_referral_code_id as string)

  const discountCodeIds = usages
    .filter((u) => u.discount_code_id)
    .map((u) => u.discount_code_id as string)

  const { data: userCodes } = userCodeIds.length
    ? await supabase.from('user_referral_codes').select('id, code').in('id', userCodeIds)
    : { data: [] }

  const { data: discountCodes } = discountCodeIds.length
    ? await supabase.from('discount_codes').select('id, code').in('id', discountCodeIds)
    : { data: [] }

  const userCodeMap = new Map((userCodes ?? []).map((c) => [c.id, c.code]))
  const discountCodeMap = new Map((discountCodes ?? []).map((c) => [c.id, c.code]))

  const enriched = usages.map((u) => ({
    ...u,
    referred_user: profileMap.get(u.referred_user_id) ?? null,
    referrer_code: u.user_referral_code_id ? userCodeMap.get(u.user_referral_code_id) : null,
    discount_code: u.discount_code_id ? discountCodeMap.get(u.discount_code_id) : null,
  }))

  return NextResponse.json(enriched)
}
