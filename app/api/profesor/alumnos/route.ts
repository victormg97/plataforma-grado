import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, puede_crear_alumno')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'profesor' || !profile?.puede_crear_alumno) {
    return NextResponse.json({ error: 'No tienes permisos para crear alumnos' }, { status: 403 });
  }

  const body = await request.json();
  const { nombre, apellido, email, telefono, universidad, año_ingreso, useAppEmail, modo_creacion } = body;

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

  // Create alumnos_extra auto-assigning to current user
  await supabase.from('alumnos_extra').insert({
    alumno_id: newUser.user.id,
    profesor_id: user.id,
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
    
    // Use admin client to bypass RLS on invitations table
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminClient = createAdminClient();
    await adminClient.from('invitations').insert({
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
