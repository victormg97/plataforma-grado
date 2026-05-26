import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Run auth check and param parsing in parallel
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const profesorFilter = searchParams.get('profesor_id');
  const estadoFilter = searchParams.get('estado');
  const q = searchParams.get('q');

  // Run rol check and main query in parallel
  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase.from('profiles').select('rol').eq('id', user.id).single(),
    supabase.rpc('get_alumnos_admin', {
      p_q: q || null,
      p_profesor_id: profesorFilter || null,
      p_estado: estadoFilter || null,
    }),
  ]);

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (rows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id,
    nombre: r.nombre,
    apellido: r.apellido,
    apellido_materno: r.apellido_materno,
    email: r.email,
    telefono: r.telefono,
    avatar_url: r.avatar_url,
    activo: r.activo,
    estado_cuenta: r.estado === 'pendiente' ? 'Pendiente' : 'Activo',
    estado: r.estado,
    profesor_id: r.profesor_id,
    profesor: r.profesor_id ? { id: r.profesor_id, nombre: r.profesor_nombre, apellido: r.profesor_apellido } : null,
    universidad: r.universidad,
    año_ingreso: r.año_ingreso,
    fecha_ingreso: r.fecha_ingreso,
    notas: r.notas,
    paso_prueba: r.paso_prueba ?? false,
    fecha_prueba: r.fecha_prueba,
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
  const { nombre, apellido, apellido_materno, email, telefono, profesor_id, universidad, año_ingreso, useAppEmail, modo_creacion } = body;

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

  // Update profile with phone and apellido_materno
  if (newUser.user) {
    const profileUpdates: Record<string, string> = {};
    if (telefono) profileUpdates.telefono = telefono;
    if (apellido_materno) profileUpdates.apellido_materno = apellido_materno;
    if (Object.keys(profileUpdates).length > 0) {
      await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', newUser.user.id);
    }
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
