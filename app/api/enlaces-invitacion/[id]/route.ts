import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transicionEstado } from '@/lib/enlaces/acciones';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 }) };

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return { supabase, error: NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 }) };
  }
  return { supabase, error: null as null };
}

// ─── PATCH: editar profesor asignado o alternar estado ────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));

  const { data: enlace, error: fetchError } = await supabase
    .from('enlaces_invitacion')
    .select('id, tipo, estado, profesor_asignado, eliminado')
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !enlace || enlace.eliminado) {
    return NextResponse.json({ error: 'NO_ENCONTRADO' }, { status: 404 });
  }

  // ── Alternar estado ──
  if (body?.accion === 'habilitar' || body?.accion === 'deshabilitar') {
    const res = transicionEstado(enlace.estado, body.accion);
    if (!res.ok) {
      if (res.motivo === 'usado_no_reactivable') {
        return NextResponse.json({ error: 'ENLACE_USADO' }, { status: 409 });
      }
      return NextResponse.json({ error: 'TRANSICION_INVALIDA' }, { status: 409 });
    }
    const { error: updError } = await supabase
      .from('enlaces_invitacion')
      .update({ estado: res.estado, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updError) {
      return NextResponse.json({ error: 'ERROR_DB', message: updError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── Editar profesor asignado (solo alumno activo) ──
  if (Object.prototype.hasOwnProperty.call(body, 'profesor_asignado')) {
    if (enlace.tipo !== 'alumno' || enlace.estado !== 'activo') {
      return NextResponse.json({ error: 'NO_EDITABLE' }, { status: 409 });
    }
    const nuevoProfesor: string | null = body.profesor_asignado ?? null;

    if (nuevoProfesor) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, rol')
        .eq('id', nuevoProfesor)
        .maybeSingle();
      if (!prof || (prof.rol !== 'profesor' && prof.rol !== 'admin')) {
        return NextResponse.json({ error: 'VALIDACION', message: 'profesor_asignado inválido' }, { status: 422 });
      }
    }

    const { error: updError } = await supabase
      .from('enlaces_invitacion')
      .update({ profesor_asignado: nuevoProfesor, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updError) {
      return NextResponse.json({ error: 'ERROR_DB', message: updError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'SIN_CAMBIOS' }, { status: 400 });
}

// ─── DELETE: soft-delete ──────────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return authError;

  const { error } = await supabase
    .from('enlaces_invitacion')
    .update({ eliminado: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
