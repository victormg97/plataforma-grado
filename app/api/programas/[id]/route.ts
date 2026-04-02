import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { programaSchema } from '@/lib/validations/programa.schema';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (!profile || profile.rol === 'alumno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data, error } = await supabase
    .from('programas_clases')
    .select(`
      *,
      profesor:profiles!programas_clases_profesor_id_fkey(id, nombre, apellido, avatar_url),
      creado_por:profiles!programas_clases_created_by_fkey(id, nombre, apellido),
      programa_profesores(profesor_id, profesor:profiles!programa_profesores_profesor_id_fkey(id, nombre, apellido, avatar_url)),
      clases_programa(*)
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Sort clases by orden
  if (data.clases_programa) {
    data.clases_programa.sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden);
  }

  // Get assignments with alumno profiles
  const { data: asignaciones } = await supabase
    .from('asignaciones_programa')
    .select('*, alumno:profiles!asignaciones_programa_alumno_id_fkey(id, nombre, apellido, avatar_url, email)')
    .eq('programa_id', id)
    .eq('estado', 'activo');

  const clases = (data.clases_programa ?? []) as { tipo: string }[];
  const profesoresAsignados = ((data.programa_profesores ?? []) as { profesor: { id: string; nombre: string; apellido: string; avatar_url: string | null } }[])
    .map((pp) => pp.profesor);

  return NextResponse.json({
    ...data,
    programa_profesores: undefined,
    profesores_asignados: profesoresAsignados,
    total_clases: clases.length,
    total_pruebas: clases.filter((c) => c.tipo === 'prueba').length,
    total_asignados: (asignaciones ?? []).length,
    asignaciones: asignaciones ?? [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (!profile || profile.rol === 'alumno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  // Verify ownership (RLS handles this too, but explicit check for better error messages)
  const { data: existing } = await supabase
    .from('programas_clases')
    .select('created_by')
    .eq('id', id)
    .single();
  if (!existing) return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 });
  if (profile.rol !== 'admin' && existing.created_by !== user.id) {
    return NextResponse.json({ error: 'No autorizado para editar este programa' }, { status: 403 });
  }

  const body = await request.json();

  // Handle restore action
  if (body.estado === 'activo') {
    const { data, error } = await supabase
      .from('programas_clases')
      .update({ estado: 'activo' })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Handle soft-delete
  if (body.estado === 'eliminado') {
    const { data, error } = await supabase
      .from('programas_clases')
      .update({ estado: 'eliminado' })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Handle name/description/visibilidad update
  const parsed = programaSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.nombre !== undefined) updateData.nombre = parsed.data.nombre;
  if (parsed.data.descripcion !== undefined) updateData.descripcion = parsed.data.descripcion ?? null;

  // Only admin can change visibilidad
  if (profile.rol === 'admin' && parsed.data.visibilidad !== undefined) {
    updateData.visibilidad = parsed.data.visibilidad;
    // Also update legacy profesor_id field
    const newProfesorIds = parsed.data.profesor_ids ?? [];
    updateData.profesor_id = newProfesorIds[0] ?? null;

    // Sync junction table: delete all existing, re-insert new ones
    await supabase.from('programa_profesores').delete().eq('programa_id', id);
    if (parsed.data.visibilidad === 'especifico' && newProfesorIds.length > 0) {
      await supabase
        .from('programa_profesores')
        .insert(newProfesorIds.map((pid: string) => ({ programa_id: id, profesor_id: pid })));
    }
  } else if (profile.rol === 'admin' && parsed.data.profesor_ids !== undefined) {
    // Admin passed profesor_ids without explicitly changing visibilidad — infer it
    const newProfesorIds = parsed.data.profesor_ids;
    const newVisibilidad = newProfesorIds.length > 0 ? 'especifico' : 'todos';
    updateData.visibilidad = newVisibilidad;
    updateData.profesor_id = newProfesorIds[0] ?? null;

    await supabase.from('programa_profesores').delete().eq('programa_id', id);
    if (newProfesorIds.length > 0) {
      await supabase
        .from('programa_profesores')
        .insert(newProfesorIds.map((pid: string) => ({ programa_id: id, profesor_id: pid })));
    }
  }

  const { data, error } = await supabase
    .from('programas_clases')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}


export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (!profile || profile.rol === 'alumno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data: existing } = await supabase
    .from('programas_clases')
    .select('created_by, estado')
    .eq('id', id)
    .single();
  if (!existing) return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 });
  if (profile.rol !== 'admin' && existing.created_by !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const url = new URL(req.url);
  const definitivo = url.searchParams.get('definitivo') === 'true';

  if (definitivo) {
    if (existing.estado !== 'eliminado') {
      return NextResponse.json({ error: 'Solo se pueden eliminar definitivamente programas en la papelera' }, { status: 400 });
    }
    const { error } = await supabase.from('programas_clases').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Soft delete — cascade future student classes and unlink students
  const { data: timeData } = await supabase.rpc('get_server_time');
  const todayChile = timeData ? timeData.split('T')[0] : new Date().toISOString().split('T')[0];

  // Get active asignaciones for this program (need alumno_id to clean notifications)
  const { data: asignaciones } = await supabase
    .from('asignaciones_programa')
    .select('id, alumno_id')
    .eq('programa_id', id)
    .eq('estado', 'activo');

  const asignacionIds = (asignaciones ?? []).map((a: { id: string; alumno_id: string }) => a.id);
  const alumnoIds = (asignaciones ?? []).map((a: { id: string; alumno_id: string }) => a.alumno_id);

  if (asignacionIds.length > 0) {
    // Get all clases of this program
    const { data: clases } = await supabase
      .from('clases_programa')
      .select('id')
      .eq('programa_id', id);

    const claseIds = (clases ?? []).map((c: { id: string }) => c.id);

    if (claseIds.length > 0) {
      // Get horario_ids linked to these asignaciones and classes
      const { data: horarioLinks } = await supabase
        .from('horarios_programa')
        .select('horario_id')
        .in('asignacion_id', asignacionIds)
        .in('clase_id', claseIds);

      const horarioIds = (horarioLinks ?? []).map((h: { horario_id: string }) => h.horario_id);

      if (horarioIds.length > 0) {
        // Delete future horarios only (hora_inicio >= today in Chile TZ)
        await supabase
          .from('horarios')
          .delete()
          .in('id', horarioIds)
          .gte('hora_inicio', `${todayChile}T00:00:00`);
      }

      // Delete future pruebas linked to these classes
      await supabase
        .from('pruebas')
        .delete()
        .in('clase_id', claseIds)
        .gte('fecha', todayChile);
    }

    // Unlink all active students from the program (they keep past history)
    await supabase
      .from('asignaciones_programa')
      .update({ estado: 'eliminado' })
      .in('id', asignacionIds);

    // Remove "programa_asignado" notifications for all unlinked students via
    // SECURITY DEFINER function (bypasses "destinatario_id = auth.uid()" RLS).
    if (alumnoIds.length > 0) {
      await supabase.rpc('delete_programa_asignado_notifications', {
        p_programa_id: id,
        p_alumno_ids: alumnoIds,
      });
    }
  }

  // Soft delete the program
  const { error } = await supabase
    .from('programas_clases')
    .update({ estado: 'eliminado' })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}



