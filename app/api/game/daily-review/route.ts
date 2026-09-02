import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';

// GET: review of TODAY's already-answered daily question for the current user.
// Safe to expose correctness + explanation because the user already answered.
// Returns { answered: false } when the user hasn't answered today's question.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('get_daily_review', {
    p_tenant: tenantConfig.id,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data);
}
