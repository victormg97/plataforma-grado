import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { weeklyCaseResolutionSchema } from '@/lib/comunidad/weekly-case';

// POST: publish the commented resolution of a closed case (closed -> resolved).
// The RPC re-validates admin (defense in depth) and that the case is closed.
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = weeklyCaseResolutionSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'INVALID';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('publish_weekly_case_resolution', {
    p_tenant: tenantConfig.id,
    p_case_id: parsed.data.case_id,
    p_resolution_content: parsed.data.resolution_content,
    p_visibility: parsed.data.resolution_visibility,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  const result = data as { ok: boolean; error_code?: string };
  if (!result.ok) {
    const code = result.error_code ?? 'ERROR';
    const status = code === 'CASE_NOT_CLOSED' ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }

  return NextResponse.json(result);
}
