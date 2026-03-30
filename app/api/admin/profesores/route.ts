import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTempPassword } from '@/lib/utils/formatters';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  }

  // Get all professors with student count
  const { data: profesores, error } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, email, telefono, avatar_url, activo, rol')
    .in('rol', ['profesor', 'admin'])
    .order('nombre');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get student counts per professor
  const { data: counts } = await supabase
    .from('alumnos_extra')
    .select('profesor_id');

  const countMap: Record<string, number> = {};
  for (const c of counts ?? []) {
    if (c.profesor_id) {
      countMap[c.profesor_id] = (countMap[c.profesor_id] || 0) + 1;
    }
  }

  const result = (profesores ?? []).map((p) => ({
    ...p,
    alumnos_count: countMap[p.id] || 0,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  }

  const body = await request.json();
  const { nombre, apellido, email, telefono } = body;

  if (!nombre || !apellido || !email) {
    return NextResponse.json({ error: 'Nombre, apellido y email son requeridos' }, { status: 400 });
  }

  const tempPassword = generateTempPassword();
  const adminClient = createAdminClient();

  const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { nombre, apellido, rol: 'profesor' },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Update profile with phone
  if (telefono && newUser.user) {
    await supabase
      .from('profiles')
      .update({ telefono })
      .eq('id', newUser.user.id);
  }

  return NextResponse.json({
    profesor: newUser.user,
    temp_password: tempPassword,
  }, { status: 201 });
}
