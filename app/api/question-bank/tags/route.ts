import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { tagSchema } from '@/lib/validations/question-bank.schema';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('qb_tags')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .order('name');

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = tagSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDACION', issues: parsed.error.issues }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('qb_tags')
    .insert({ ...parsed.data, tenant: tenantConfig.id })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'DUPLICADO', message: 'Ya existe un tag con ese nombre' }, { status: 409 });
    }
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
