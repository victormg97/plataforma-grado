import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendNotificationEmail } from '@/lib/email/emailService';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Run rol check and main query in parallel
  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase.from('profiles').select('rol').eq('id', user.id).single(),
    supabase.rpc('get_profesores_admin'),
  ]);

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(rows ?? []);
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
  const { nombre, apellido, apellido_materno, email, telefono, useAppEmail, modo_creacion, puede_crear_alumno } = body;

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
    ? generateDefaultPassword('profesor') 
    : generateSecurePassword('profesor');

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
      data: { nombre, apellido, rol: 'profesor' }
    }
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Update profile with phone and puede_crear_alumno
  if (newUser.user) {
    const updates: Record<string, string | boolean> = {};
    if (telefono) updates.telefono = telefono;
    if (apellido_materno) updates.apellido_materno = apellido_materno;
    if (typeof puede_crear_alumno === 'boolean') updates.puede_crear_alumno = puede_crear_alumno;
    
    if (Object.keys(updates).length > 0) {
      await supabase
        .from('profiles')
        .update(updates)
        .eq('id', newUser.user.id);
    }
  }

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

    // Correo de invitación de acceso al usuario recién creado (Requisito 19).
    // Fire-and-forget: la respuesta no espera al correo; un fallo no revierte la creación.
    // El Verificador_Destinatario descarta automáticamente los correos del dominio de marca (useAppEmail).
    void sendNotificationEmail({
      tipo: 'invitacion_acceso',
      originadorId: user.id,
      destinatarioId: newUser.user.id,
      destinatarioEmail: finalEmail,
      destinatarioIdioma: null,
      variables: {
        nombre_destinatario: `${nombre} ${apellido}`.trim(),
        enlace_acceso: `${process.env.NEXT_PUBLIC_APP_URL}/setup/${code}`,
        email_acceso: finalEmail,
      },
      horarioId: null,
      eventoId: `invitacion:${newUser.user.id}`,
    }).catch(() => {});
  }

  return NextResponse.json({
    profesor: newUser.user,
    email: finalEmail,
    password: modo === 'link' ? null : tempPassword,
    setup_code: codeLink
  }, { status: 201 });
}
