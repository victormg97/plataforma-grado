import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('qb_subjects')
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
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'VALIDACION', message: 'El nombre es requerido' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('qb_subjects')
    .insert({ name, tenant: tenantConfig.id, keywords: body.keywords || [] })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'DUPLICADO', message: 'Ya existe una materia con ese nombre' }, { status: 409 });
    }
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
