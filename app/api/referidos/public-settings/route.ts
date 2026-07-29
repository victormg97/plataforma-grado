import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tenantConfig } from '@/config'

/**
 * GET /api/referidos/public-settings
 * Public endpoint (no auth required) — returns only the minimal info
 * needed by the registration form to decide whether to show the
 * referral code field.
 *
 * Returns: { platform_enabled, tenant_enabled, display_name }
 * Does NOT expose internal settings like icon, reward config, etc.
 */
export async function GET(_req: NextRequest) {
  const admin = createAdminClient()

  const { data: settings } = await admin
    .from('referral_settings')
    .select('platform_enabled, tenant_enabled, display_name')
    .eq('tenant', tenantConfig.id)
    .maybeSingle()

  if (!settings) {
    return NextResponse.json({
      platform_enabled: false,
      tenant_enabled: false,
      display_name: 'Sistema de Referidos',
    })
  }

  return NextResponse.json({
    platform_enabled: settings.platform_enabled,
    tenant_enabled: settings.tenant_enabled,
    display_name: settings.display_name,
  })
}
