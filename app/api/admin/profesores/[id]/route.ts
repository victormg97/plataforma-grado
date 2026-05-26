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

  // Run profile and invitation queries in parallel
  const [{ data, error }, { data: current_invitation }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nombre, apellido, apellido_materno, email, telefono, avatar_url, activo, rol, puede_crear_alumno')
      .eq('id', id)
      .single(),
    supabase
      .from('invitations')
      .select('code, temp_password, invitation_type, expires_at')
      .eq('user_id', id)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ]);

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  return NextResponse.json({ ...data, current_invitation: current_invitation || null });
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
    const tempPassword = (oldInv as { temp_password?: string })?.temp_password ?? generateDefaultPassword('profesor');

    // If user is already activated (no pending invitation), reset their Supabase auth password
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


  const updates: Record<string, unknown> = {};

  if (typeof body.activo === 'boolean') updates.activo = body.activo;
  if (body.nombre !== undefined) updates.nombre = body.nombre;
  if (body.apellido !== undefined) updates.apellido = body.apellido;
  if (body.apellido_materno !== undefined) updates.apellido_materno = body.apellido_materno;
  if (body.telefono !== undefined) updates.telefono = body.telefono;
  if (typeof body.puede_crear_alumno === 'boolean') updates.puede_crear_alumno = body.puede_crear_alumno;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
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

  // Check if professor has assigned students - warn but don't block
  const { count } = await supabase
    .from('alumnos_extra')
    .select('*', { count: 'exact', head: true })
    .eq('profesor_id', id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: este profesor tiene ${count} alumno(s) asignado(s). Reasígnalos primero.` },
      { status: 409 }
    );
  }

  // Delete associated data first
  await supabase.from('invitations').delete().eq('user_id', id);

  // Hard delete the profile
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
