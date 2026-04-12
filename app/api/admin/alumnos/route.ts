import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  // Get all active invitations to identify pending users
  const { data: invs } = await supabase
    .from('invitations')
    .select('user_id')
    .in('user_id', alumnoIds.length > 0 ? alumnoIds : ['none'])
    .eq('used', false);
    
  const pendingSet = new Set((invs ?? []).map(i => i.user_id));

  let result = (alumnos ?? []).map((a) => {
    const extra = extrasMap.get(a.id) as Record<string, unknown> | undefined;
    const profId = extra?.profesor_id as string | null;
    return {
      ...a,
      estado_cuenta: pendingSet.has(a.id) ? 'Pendiente' : 'Activo',
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
  const { nombre, apellido, email, telefono, profesor_id, universidad, año_ingreso, useAppEmail, modo_creacion } = body;

  if (!nombre || !apellido) {
    return NextResponse.json({ error: 'Nombre y apellido son requeridos' }, { status: 400 });
  }

  const modo = modo_creacion === 'default' ? 'default' : 'link';

  // Handle email logic
  let finalEmail = email;
  if (useAppEmail) {
    const { generateAppEmail } = await import('@/lib/utils/account-generator');
    finalEmail = await generateAppEmail(nombre, apellido);
  }

  if (!finalEmail) {
    return NextResponse.json({ error: 'Falta proveer un correo o habilitar correo de app' }, { status: 400 });
  }

  const { generateSecurePassword, generateDefaultPassword } = await import('@/lib/utils/account-generator');
  
  const tempPassword = modo === 'default' 
    ? generateDefaultPassword('alumno') 
    : generateSecurePassword('alumno');

  const { createClient: createBrowserClient } = await import('@supabase/supabase-js');
  const tempAuthClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: newUser, error: authError } = await tempAuthClient.auth.signUp({
    email: finalEmail,
    password: tempPassword,
    options: {
      data: { nombre, apellido, rol: 'alumno' }
    }
  });

  if (authError) {
    const msg = authError.message === 'User already registered'
      ? 'Ese correo ya está registrado en el sistema'
      : authError.message;
    return NextResponse.json({ error: msg }, { status: 500 });
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

  let codeLink = null;

  if (newUser.user) {
    const { generateShortCode } = await import('@/lib/utils/invitations');
    const code = generateShortCode(8);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24 * 365 * 10); // 10 years validity if default, or 24h if link
    if (modo === 'link') {
      expiresAt.setTime(new Date().getTime() + 24 * 60 * 60 * 1000); // 24 hours
    }
    
    await supabase.from('invitations').insert({
      code,
      user_id: newUser.user.id,
      email: finalEmail,
      temp_password: tempPassword,
      expires_at: expiresAt.toISOString(),
      used: false,
      invitation_type: modo
    });
    
    if (modo === 'link') {
      codeLink = code;
    }
  }

  return NextResponse.json({
    alumno: newUser.user,
    email: finalEmail,
    password: modo === 'link' ? null : tempPassword,
    setup_code: codeLink
  }, { status: 201 });
}
