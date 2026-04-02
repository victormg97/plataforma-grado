import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; alumno_id: string }> }
) {
  const { id: programaId, alumno_id: alumnoId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (!profile || profile.rol === 'alumno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  // Verify ownership of program
  const { data: programa } = await supabase
    .from('programas_clases')
    .select('created_by')
    .eq('id', programaId)
    .single();
  if (!programa) return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 });
  if (profile.rol !== 'admin' && programa.created_by !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const nowUtc = new Date();
  const todayChile = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(nowUtc);
  const nowTimeChile = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(nowUtc);

  // Find assignment tracking ID to delete future schedule bounds intelligently
  const { data: asignacion } = await supabase
    .from('asignaciones_programa')
    .select('id')
    .eq('programa_id', programaId)
    .eq('alumno_id', alumnoId)
    .single();

  if (asignacion) {
    const { data: relHorarios } = await supabase
      .from('horarios_programa')
      .select('horario_id')
      .eq('asignacion_id', asignacion.id);

    if (relHorarios && relHorarios.length > 0) {
      const hIds = relHorarios.map(h => h.horario_id);
      const { data: horariosToDelete } = await supabase.from('horarios').select('id, fecha, hora_inicio').in('id', hIds);
      
      if (horariosToDelete) {
        const toDeleteIds = horariosToDelete.filter(h => {
          return h.fecha > todayChile || (h.fecha === todayChile && h.hora_inicio > nowTimeChile);
        }).map(h => h.id);
        
        if (toDeleteIds.length > 0) {
          await supabase.from('horarios').delete().in('id', toDeleteIds);
        }
      }
    }

    const { data: clasesP } = await supabase.from('clases_programa').select('id').eq('programa_id', programaId);
    if (clasesP && clasesP.length > 0) {
      const cIds = clasesP.map(c => c.id);
      // Delete pruebas scheduled from today onwards (no time column, use gte)
      await supabase.from('pruebas')
        .delete()
        .eq('alumno_id', alumnoId)
        .in('clase_id', cIds)
        .gte('fecha', todayChile);
    }
  }

  // Delete link permanently
  const { error } = await supabase
    .from('asignaciones_programa')
    .delete()
    .eq('programa_id', programaId)
    .eq('alumno_id', alumnoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Remove the "programa_asignado" notification for this student via SECURITY DEFINER
  // function (bypasses the "destinatario_id = auth.uid()" RLS on notificaciones).
  await supabase.rpc('delete_programa_asignado_notifications', {
    p_programa_id: programaId,
    p_alumno_ids: [alumnoId],
  });

  return NextResponse.json({ success: true });
}
