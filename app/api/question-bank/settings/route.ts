import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('question_bank_settings')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  // Default response if no settings row exists
  if (!data) {
    return NextResponse.json({ question_bank_enabled: false, tenant: tenantConfig.id });
  }

  return NextResponse.json(data);
}
