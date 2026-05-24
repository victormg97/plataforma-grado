import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: me } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (me?.rol !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, email, telefono, avatar_url, activo, rol')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Get additional alumni info
  const { data: extra } = await supabase
    .from('alumnos_extra')
    .select('*')
    .eq('alumno_id', id)
    .single();

  // Get active invitation if pending
  const { data: current_invitation } = await supabase
    .from('invitations')
    .select('code, temp_password, invitation_type, expires_at')
    .eq('user_id', id)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ ...data, ...extra, current_invitation: current_invitation || null });
}


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  if (body.action === 'regenerate_access') {
    const { modo_creacion } = body;
    const modo = modo_creacion === 'default' ? 'default' : 'link';

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', id)
      .single();

    if (!targetProfile?.email) {
      return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
    }

    const { generateDefaultPassword } = await import('@/lib/utils/account-generator');
    const { generateShortCode } = await import('@/lib/utils/invitations');

    // Check for existing pending invitation (may or may not exist)
    const { data: oldInv } = await supabase
      .from('invitations')
      .select('temp_password')
      .eq('user_id', id)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Use existing temp_password if available, otherwise generate a new one
    const tempPassword = (oldInv as { temp_password?: string })?.temp_password ?? generateDefaultPassword('alumno');

    // If user is already activated (no pending invitation), we must reset their
    // Supabase auth password to the temp_password so the setup flow can sign in
    if (!oldInv) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const adminClient = createAdminClient();
      const { error: resetError } = await adminClient.auth.admin.updateUserById(id, {
        password: tempPassword,
      });
      if (resetError) {
        return NextResponse.json({ error: 'No se pudo preparar el acceso temporal' }, { status: 500 });
      }
    }

    const code = generateShortCode(8);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (modo === 'link' ? 24 : 24 * 365 * 10));

    // Delete old pending invitations and create a new one
    await supabase.from('invitations').delete().eq('user_id', id).eq('used', false);
    await supabase.from('invitations').insert({
      code,
      user_id: id,
      email: targetProfile.email,
      temp_password: tempPassword,
      expires_at: expiresAt.toISOString(),
      used: false,
      invitation_type: modo,
    });

    return NextResponse.json({
      setup_code: modo === 'link' ? code : null,
      password: modo === 'link' ? null : tempPassword,
    });
  }


  // Update profile fields
  const profileUpdates: Record<string, unknown> = {};
  if (typeof body.activo === 'boolean') profileUpdates.activo = body.activo;
  if (body.nombre !== undefined) profileUpdates.nombre = body.nombre;
  if (body.apellido !== undefined) profileUpdates.apellido = body.apellido;
  if (body.telefono !== undefined) profileUpdates.telefono = body.telefono;

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Update alumnos_extra fields
  const extraUpdates: Record<string, unknown> = {};
  if (body.profesor_id !== undefined) extraUpdates.profesor_id = body.profesor_id;
  if (body.universidad !== undefined) extraUpdates.universidad = body.universidad;
  if (body.año_ingreso !== undefined) extraUpdates.año_ingreso = body.año_ingreso;
  if (body.notas !== undefined) extraUpdates.notas = body.notas;
  if (typeof body.paso_prueba === 'boolean') {
    extraUpdates.paso_prueba = body.paso_prueba;
    if (body.paso_prueba && body.fecha_prueba) {
      extraUpdates.fecha_prueba = body.fecha_prueba;
    } else if (!body.paso_prueba) {
      extraUpdates.fecha_prueba = null;
    }
  }

  if (Object.keys(extraUpdates).length > 0) {
    const { error } = await supabase
      .from('alumnos_extra')
      .update(extraUpdates)
      .eq('alumno_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: me } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (me?.rol !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  // Delete associated data first
  await supabase.from('invitations').delete().eq('user_id', id);
  await supabase.from('alumnos_extra').delete().eq('alumno_id', id);

  // Delete the profile
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete from auth.users to allow re-creating with the same email
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminClient = createAdminClient();
  await adminClient.auth.admin.deleteUser(id);

  return NextResponse.json({ ok: true });
}
