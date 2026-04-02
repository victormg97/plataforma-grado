import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { claseSchema } from '@/lib/validations/programa.schema';

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

  const body = await request.json();
  const parsed = claseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Calculate next order if not provided
  let orden = parsed.data.orden;
  if (!orden) {
    const { data: maxOrden } = await supabase
      .from('clases_programa')
      .select('orden')
      .eq('programa_id', programaId)
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle();
    orden = (maxOrden?.orden ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from('clases_programa')
    .insert({
      programa_id: programaId,
      nombre: parsed.data.nombre,
      descripcion: parsed.data.descripcion ?? null,
      tipo: parsed.data.tipo,
      orden,
      duracion_min: parsed.data.duracion_min ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programaId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (!profile || profile.rol === 'alumno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data: programa } = await supabase
    .from('programas_clases')
    .select('created_by')
    .eq('id', programaId)
    .single();
  if (!programa) return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 });
  if (profile.rol !== 'admin' && programa.created_by !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  // Body: { clases: Array of clase update objects with id }
  const clases = body.clases as Array<{
    id: string;
    nombre: string;
    descripcion?: string | null;
    tipo: 'materia' | 'prueba';
    orden: number;
    duracion_min?: number | null;
  }>;

  if (!Array.isArray(clases)) {
    return NextResponse.json({ error: 'Se esperaba un array de clases' }, { status: 400 });
  }

  const toInsert = clases.filter((c) => !c.id);
  const toUpdate = clases.filter((c) => !!c.id);

  // 1. Evaluate removed classes to delete future student schedules
  const nowUtc = new Date();
  const todayChile = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(nowUtc);
  const nowTimeChile = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(nowUtc);

  // Identify which classes are being removed
  let removedIds: string[] = [];
  const { data: currentClases } = await supabase.from('clases_programa').select('id').eq('programa_id', programaId);
  const keptIds = toUpdate.map((c) => c.id);
  if (currentClases) {
    removedIds = currentClases.filter(cc => !keptIds.includes(cc.id)).map(cc => cc.id);
  }

  // Delete future student events for these removed classes
  if (removedIds.length > 0) {
    // Delete future pruebas (gte today since pruebas have no time field)
    await supabase.from('pruebas').delete().in('clase_id', removedIds).gte('fecha', todayChile);

    // Gather related horarios
    const { data: relHorarios } = await supabase.from('horarios_programa').select('horario_id').in('clase_id', removedIds);
    if (relHorarios && relHorarios.length > 0) {
      const hIds = relHorarios.map(h => h.horario_id);
      
      // We must fetch them to check time safely without complex SQL
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
  }

  // 2. Delete classes templates that are no longer in the list (Safe because foreign keys to surviving past events will merely SET NULL)
  if (toUpdate.length > 0) {
    const del = await supabase
      .from('clases_programa')
      .delete()
      .eq('programa_id', programaId)
      .not('id', 'in', `(${keptIds.join(',')})`);
    if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  } else {
    const del = await supabase.from('clases_programa').delete().eq('programa_id', programaId);
    if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  }

  // 2. Insert new classes
  const inserts = toInsert.length > 0
    ? await supabase
        .from('clases_programa')
        .insert(
          toInsert.map((c) => ({
            programa_id: programaId,
            nombre: c.nombre,
            descripcion: c.descripcion ?? null,
            tipo: c.tipo,
            orden: c.orden,
            duracion_min: c.duracion_min ?? null,
          }))
        )
        .select()
    : { data: [], error: null };

  if (inserts.error) return NextResponse.json({ error: inserts.error.message }, { status: 500 });

  // 3. Update existing classes
  const updates = await Promise.all(
    toUpdate.map(async (c) => {
      const res = await supabase
        .from('clases_programa')
        .update({
          nombre: c.nombre,
          descripcion: c.descripcion ?? null,
          tipo: c.tipo,
          orden: c.orden,
          duracion_min: c.duracion_min ?? null,
        })
        .eq('id', c.id)
        .eq('programa_id', programaId)
        .select()
        .single();
        
      if (!res.error) {
        // Sync names to assigned students' schedules (horarios and pruebas)
        const { data: mappings } = await supabase.from('horarios_programa').select('horario_id').eq('clase_id', c.id);
        if (mappings && mappings.length > 0) {
          const hIds = mappings.map((m) => m.horario_id);
          await supabase.from('horarios').update({ titulo: c.nombre }).in('id', hIds);
        }
        await supabase.from('pruebas').update({ nombre: c.nombre }).eq('clase_id', c.id);
      }
      return res;
    })
  );

  const failed = updates.find((u) => u.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  return NextResponse.json([...(updates.map((u) => u.data)), ...(inserts.data ?? [])]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: programaId } = await params;
  const { searchParams } = new URL(request.url);
  const claseId = searchParams.get('clase_id');
  if (!claseId) return NextResponse.json({ error: 'clase_id es requerido' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (!profile || profile.rol === 'alumno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data: programa } = await supabase
    .from('programas_clases')
    .select('created_by')
    .eq('id', programaId)
    .single();
  if (!programa) return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 });
  if (profile.rol !== 'admin' && programa.created_by !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { error } = await supabase
    .from('clases_programa')
    .delete()
    .eq('id', claseId)
    .eq('programa_id', programaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
