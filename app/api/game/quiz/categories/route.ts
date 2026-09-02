import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';

// GET: categories of a subject (?subject=) that have at least one active
// question, with the active question count. Access enforced by the RPC.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject');
  if (!subjectId) {
    return NextResponse.json({ error: 'SUBJECT_REQUERIDO' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('get_quiz_categories', {
    p_tenant: tenantConfig.id,
    p_subject_id: subjectId,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status });
  }

  return NextResponse.json(data);
}
