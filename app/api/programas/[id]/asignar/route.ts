import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { asignarProgramaSchema } from '@/lib/validations/programa.schema';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programaId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (!profile || profile.rol === 'alumno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  // Verify the program exists and caller has rights
  const { data: programa } = await supabase
    .from('programas_clases')
    .select('id, nombre, created_by, profesor_id, clases_programa!inner(id, nombre, tipo, orden)')
    .eq('id', programaId)
    .eq('estado', 'activo')
    .single();
  if (!programa) return NextResponse.json({ error: 'Programa no encontrado o eliminado' }, { status: 404 });
  if (profile.rol !== 'admin' && programa.created_by !== user.id) {
    return NextResponse.json({ error: 'No autorizado para asignar este programa' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = asignarProgramaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { alumno_ids, horarios_por_alumno } = parsed.data;

  // Notifications are handled automatically by the DB trigger
  // create_notification_on_asignacion_programa (migration 008).

  const profesorId = profile.rol === 'admin' ? (programa.profesor_id ?? user.id) : user.id;

  const results: { alumno_id: string; horarios_created: number }[] = [];
  const errors: string[] = [];

  for (const alumnoHorario of horarios_por_alumno) {
    const { alumno_id, clases } = alumnoHorario;
    if (!alumno_ids.includes(alumno_id)) continue;

    try {
      // 1. Create asignacion_programa record
      const { data: asignacion, error: asigError } = await supabase
        .from('asignaciones_programa')
        .upsert(
          {
            programa_id: programaId,
            alumno_id,
            profesor_id: profesorId,
            estado: 'activo',
          },
          { onConflict: 'programa_id,alumno_id' }
        )
        .select()
        .single();

      if (asigError || !asignacion) {
        errors.push(`Error asignando programa al alumno ${alumno_id}: ${asigError?.message}`);
        continue;
      }

      // 2. Create horarios
      const horariosInsert = clases.map((c) => ({
        profesor_id: profesorId,
        alumno_id,
        titulo: (() => {
          const claseInfo = programa.clases_programa.find(
            (cp: { id: string }) => cp.id === c.clase_id
          );
          return claseInfo ? claseInfo.nombre : `Clase del programa: ${programa.nombre}`;
        })(),
        descripcion: null as string | null,
        fecha: c.fecha,
        hora_inicio: c.hora_inicio,
        hora_fin: c.hora_fin,
        es_recurrente: false,
        activo: true,
        from_programa: true,
      }));

      const { data: horariosCreados, error: horariosError } = await supabase
        .from('horarios')
        .insert(horariosInsert)
        .select('id');

      if (horariosError || !horariosCreados) {
        errors.push(`Error creando horarios para ${alumno_id}: ${horariosError?.message}`);
        continue;
      }

      // 3. Create asistencia records with estado='pendiente'
      const asistenciaInsert = horariosCreados.map((h) => ({
        horario_id: h.id,
        alumno_id,
        estado: 'pendiente' as const,
        nuevo_horario_id: null,
        nota_alumno: null,
      }));
      await supabase.from('asistencia').insert(asistenciaInsert);

      // 4. Create horarios_programa trazability links
      const trazabilidadInsert = clases.map((c, idx) => ({
        asignacion_id: asignacion.id,
        clase_id: c.clase_id,
        horario_id: horariosCreados[idx].id,
      }));
      await supabase.from('horarios_programa').insert(trazabilidadInsert);

      // 5. Create prueba records for tipo='prueba' classes
      const pruebaClases = programa.clases_programa.filter(
        (cp: { tipo: string; id: string; nombre: string }) => cp.tipo === 'prueba'
      );
      if (pruebaClases.length > 0) {
        const pruebasInsert = pruebaClases.map((cp: { id: string; nombre: string }) => {
          const claseHorario = clases.find((c) => c.clase_id === cp.id);
          const horarioIdx = clases.findIndex((c) => c.clase_id === cp.id);
          return {
            alumno_id,
            profesor_id: profesorId,
            horario_id: horarioIdx >= 0 ? horariosCreados[horarioIdx].id : null,
            clase_id: cp.id as string | null,
            nombre: cp.nombre,
            fecha: claseHorario?.fecha ?? clases[0].fecha,
            nota: null as number | null,
            observaciones: null as string | null,
            estado: 'pendiente' as const,
          };
        });
        await supabase.from('pruebas').insert(pruebasInsert);
      }

      results.push({ alumno_id, horarios_created: horariosCreados.length });

      // 6. Send notification to the alumno (trigger was dropped in migration 009;
      //    the API route must do this so Supabase Realtime fires correctly).
      try {
        await supabase.from('notificaciones').insert({
          destinatario_id: alumno_id,
          tipo: 'programa_asignado' as const,
          mensaje: `Se te asignó el programa de clases: "${programa.nombre}"`,
          leida: false,
          horario_id: null,
          alumno_id: null,
          programa_id: programaId,
        });
      } catch { /* notification failure is non-fatal */ }
    } catch (err) {
      errors.push(`Error procesando alumno ${alumno_id}: ${String(err)}`);
    }
  }

  if (results.length === 0 && errors.length > 0) {
    return NextResponse.json({ error: 'No se pudo asignar el programa', details: errors }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    asignados: results.length,
    horarios_creados: results.reduce((sum, r) => sum + r.horarios_created, 0),
    errors: errors.length > 0 ? errors : undefined,
  });
}
