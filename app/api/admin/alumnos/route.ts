import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTempPassword } from '@/lib/utils/formatters';

export async function GET(request: NextRequest) {
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

  const { searchParams } = request.nextUrl;
  const profesorFilter = searchParams.get('profesor_id');
  const estadoFilter = searchParams.get('estado'); // activo | bloqueado | graduado
  const q = searchParams.get('q');

  // Get all alumnos with their extra data
  let query = supabase
    .from('profiles')
    .select('id, nombre, apellido, email, telefono, avatar_url, activo, rol')
    .eq('rol', 'alumno')
    .order('nombre');

  if (q) {
    query = query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,email.ilike.%${q}%`);
  }

  if (estadoFilter === 'bloqueado') {
    query = query.eq('activo', false);
  } else if (estadoFilter === 'activo') {
    query = query.eq('activo', true);
  }

  const { data: alumnos, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get alumnos_extra for all returned students
  const alumnoIds = (alumnos ?? []).map((a) => a.id);

  const { data: extras } = await supabase
    .from('alumnos_extra')
    .select('*')
    .in('alumno_id', alumnoIds.length > 0 ? alumnoIds : ['none']);

  const extrasMap = new Map((extras ?? []).map((e: Record<string, unknown>) => [e.alumno_id as string, e]));

  // Get profesor info for each unique profesor_id
  const profesorIds = [...new Set((extras ?? []).map((e: Record<string, unknown>) => e.profesor_id as string).filter(Boolean))];
  const { data: profData } = profesorIds.length > 0
    ? await supabase.from('profiles').select('id, nombre, apellido').in('id', profesorIds)
    : { data: [] };
  const profMap = new Map((profData ?? []).map((p) => [p.id, p]));

  let result = (alumnos ?? []).map((a) => {
    const extra = extrasMap.get(a.id) as Record<string, unknown> | undefined;
    const profId = extra?.profesor_id as string | null;
    return {
      ...a,
      profesor_id: profId ?? null,
      profesor: profId ? profMap.get(profId) ?? null : null,
      universidad: (extra?.universidad as string) ?? null,
      año_ingreso: (extra?.año_ingreso as string) ?? null,
      notas: (extra?.notas as string) ?? null,
      paso_prueba: (extra?.paso_prueba as boolean) ?? false,
      fecha_prueba: (extra?.fecha_prueba as string) ?? null,
    };
  });

  // Apply profesor filter after join
  if (profesorFilter) {
    result = result.filter((a) => a.profesor_id === profesorFilter);
  }

  // Apply graduado filter
  if (estadoFilter === 'graduado') {
    result = result.filter((a) => a.paso_prueba);
  }

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
  const { nombre, apellido, email, telefono, profesor_id, universidad, año_ingreso } = body;

  if (!nombre || !apellido || !email) {
    return NextResponse.json({ error: 'Nombre, apellido y email son requeridos' }, { status: 400 });
  }

  const tempPassword = generateTempPassword();
  const adminClient = createAdminClient();

  const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { nombre, apellido, rol: 'alumno' },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!newUser.user) {
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }

  // Update profile with phone
  if (telefono) {
    await supabase
      .from('profiles')
      .update({ telefono })
      .eq('id', newUser.user.id);
  }

  // Create alumnos_extra
  await supabase.from('alumnos_extra').insert({
    alumno_id: newUser.user.id,
    profesor_id: profesor_id || null,
    universidad: universidad || null,
    ['año_ingreso']: año_ingreso || null,
    notas: null,
    paso_prueba: false,
    fecha_prueba: null,
  } as never);

  return NextResponse.json({
    alumno: newUser.user,
    temp_password: tempPassword,
  }, { status: 201 });
}
