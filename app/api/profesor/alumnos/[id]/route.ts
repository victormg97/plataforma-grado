import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper: verify caller is a profesor and the alumno is assigned to them
async function verifyProfesorAccess(supabase: Awaited<ReturnType<typeof createClient>>, profesorId: string, alumnoId: string) {
  const { data } = await supabase
    .from('alumnos_extra')
    .select('alumno_id')
    .eq('alumno_id', alumnoId)
    .eq('profesor_id', profesorId)
    .single();
  return !!data;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: me } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (me?.rol !== 'profesor') return NextResponse.json({ error: 'Solo profesores' }, { status: 403 });

  const isAssigned = await verifyProfesorAccess(supabase, user.id, id);
  if (!isAssigned) return NextResponse.json({ error: 'No tienes acceso a este alumno' }, { status: 403 });

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, email, telefono, activo')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Get active invitation if pending
  const { data: current_invitation } = await supabase
    .from('invitations')
    .select('code, temp_password, invitation_type, expires_at')
    .eq('user_id', id)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ ...data, current_invitation: current_invitation || null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: me } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (me?.rol !== 'profesor') return NextResponse.json({ error: 'Solo profesores' }, { status: 403 });

  const isAssigned = await verifyProfesorAccess(supabase, user.id, id);
  if (!isAssigned) return NextResponse.json({ error: 'No tienes acceso a este alumno' }, { status: 403 });

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

    // Check for existing pending invitation
    const { data: oldInv } = await supabase
      .from('invitations')
      .select('temp_password')
      .eq('user_id', id)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const tempPassword = (oldInv as any)?.temp_password ?? generateDefaultPassword('alumno');

    // If user is already activated, reset their Supabase auth password to the temp one
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

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
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
  if (me?.rol !== 'profesor') return NextResponse.json({ error: 'Solo profesores' }, { status: 403 });

  // Only allow deleting own assigned students
  const isAssigned = await verifyProfesorAccess(supabase, user.id, id);
  if (!isAssigned) return NextResponse.json({ error: 'No tienes acceso a este alumno' }, { status: 403 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminClient = createAdminClient();

  // Delete associated records (admin client to bypass RLS)
  await adminClient.from('invitations').delete().eq('user_id', id);
  await adminClient.from('alumnos_extra').delete().eq('alumno_id', id);

  const { error } = await adminClient.from('profiles').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Remove from auth.users so email can be reused
  await adminClient.auth.admin.deleteUser(id);

  return NextResponse.json({ ok: true });
}
