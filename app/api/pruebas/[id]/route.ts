import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calificarPruebaSchema } from '@/lib/validations/prueba.schema';
import { getTranslations } from 'next-intl/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const t = await getTranslations('api_errors');
  if (!user) return NextResponse.json({ error: t('no_autorizado') }, { status: 401 });

  const { data: prueba, error } = await supabase
    .from('pruebas')
    .select(`
      *,
      alumno:profiles!pruebas_alumno_id_fkey(id, nombre, apellido, apellido_materno, avatar_url),
      profesor:profiles!pruebas_profesor_id_fkey(id, nombre, apellido),
      horario:horarios(id, titulo, fecha, hora_inicio, hora_fin),
      clase:clases_programa(id, nombre, tipo, orden, programa_id)
    `)
    .eq('id', id)
    .single();

  if (error || !prueba) return NextResponse.json({ error: t('prueba_no_encontrada') }, { status: 404 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  // Access control
  if (profile?.rol === 'alumno' && prueba.alumno_id !== user.id) {
    return NextResponse.json({ error: t('no_autorizado') }, { status: 403 });
  }
  if (profile?.rol === 'profesor' && prueba.profesor_id !== user.id) {
    return NextResponse.json({ error: t('no_autorizado') }, { status: 403 });
  }

  return NextResponse.json(prueba);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const t = await getTranslations('api_errors');
  
  if (!user) return NextResponse.json({ error: t('no_autorizado') }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (!profile || profile.rol === 'alumno') {
    return NextResponse.json({ error: t('solo_profesores_admins') }, { status: 403 });
  }

  // Verify ownership (profesor can only grade their own students')
  const { data: prueba } = await supabase
    .from('pruebas')
    .select('id, profesor_id, alumno_id, estado, nota, clase_id, horario_id, horario:horarios(fecha, hora_inicio)')
    .eq('id', id)
    .single();

  if (!prueba) return NextResponse.json({ error: t('prueba_no_encontrada') }, { status: 404 });
  if (profile.rol === 'profesor' && prueba.profesor_id !== user.id) {
    return NextResponse.json({ error: t('no_autorizado_evaluar') }, { status: 403 });
  }

  const body = await request.json();
  const parsed = calificarPruebaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { nota, observaciones } = parsed.data;
  const newEstado = nota !== undefined && nota !== null ? 'calificada' : 'realizada';

  const { data: updated, error } = await supabase
    .from('pruebas')
    .update({
      nota: nota ?? null,
      observaciones: observaciones ?? null,
      estado: newEstado,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  let needs_scheduling = false;

  // Advanced Bi-directional Shifting Logic
  const wasFailing = prueba.nota !== null && prueba.nota < 4.0;
  const wasPassingOrEmpty = prueba.nota === null || prueba.nota >= 4.0;
  const isNowFailing = nota !== undefined && nota !== null && nota < 4.0;
  const isNowPassingOrEmpty = nota === undefined || nota === null || nota >= 4.0;

  if ((isNowFailing && wasPassingOrEmpty) || (wasFailing && isNowPassingOrEmpty)) {
    try {
      if (prueba.clase_id && prueba.alumno_id) {
        const { data: claseProg, error: errC } = await supabase.from('clases_programa').select('programa_id').eq('id', prueba.clase_id).single();
        if (errC) throw errC;

        if (claseProg) {
          const { data: asig, error: errA } = await supabase.from('asignaciones_programa').select('id').eq('programa_id', claseProg.programa_id).eq('alumno_id', prueba.alumno_id).single();
          if (errA) throw errA;

          if (asig) {
            const failedFecha = typeof prueba.horario === 'object' && !Array.isArray(prueba.horario) && prueba.horario !== null ? prueba.horario.fecha : null;
            const failedHora = typeof prueba.horario === 'object' && !Array.isArray(prueba.horario) && prueba.horario !== null ? prueba.horario.hora_inicio : null;
            
            if (failedFecha && failedHora) {
               const { data: upcomingClasses, error: errU } = await supabase
                 .from('horarios_programa')
                 .select('id, clase_id, horario_id, horarios!inner(fecha, hora_inicio)')
                 .eq('asignacion_id', asig.id);
               if (errU) throw errU;
               
               if (upcomingClasses) {
                 const futureClasses = upcomingClasses
                   .filter((c: any) => {
                     if (!c.horarios) return false;
                     if (c.horarios.fecha > failedFecha) return true;
                     if (c.horarios.fecha === failedFecha && c.horarios.hora_inicio > failedHora) return true;
                     return false;
                   })
                   .sort((a: any, b: any) => {
                     if (a.horarios.fecha !== b.horarios.fecha) return a.horarios.fecha.localeCompare(b.horarios.fecha);
                     return a.horarios.hora_inicio.localeCompare(b.horarios.hora_inicio);
                   });
                   
                 if (futureClasses.length > 0) {
                     const nextDateStr = futureClasses[0].horarios.fecha;
                     const nextTimeStr = futureClasses[0].horarios.hora_inicio;
                     
                     const now = new Date();
                     now.setHours(now.getHours() - 4); 
                     const nowDateStr = now.toISOString().split('T')[0];
                     const nowTimeStr = now.toISOString().split('T')[1].slice(0, 8);
                     
                     const isWindowClosed = (nowDateStr > nextDateStr || (nowDateStr === nextDateStr && nowTimeStr >= nextTimeStr));

                     if (isWindowClosed) {
                         // The next class already occurred. Never shift.
                         needs_scheduling = true;
                     } else if (isNowFailing && wasPassingOrEmpty) {
                         // === SHIFT DOWN (PUSH) ===
                         let nextClaseIdToPush: string | null = prueba.clase_id;
                         for (let i = 0; i < futureClasses.length; i++) {
                           const slot = futureClasses[i];
                           const oldClaseIdInSlot = slot.clase_id;
                           
                           const { error: err1 } = await supabase.from('horarios_programa').update({ clase_id: nextClaseIdToPush }).eq('id', slot.id);
                           if (err1) throw err1;
                           
                           if (nextClaseIdToPush) {
                             const { data: targetClase, error: err2 } = await supabase.from('clases_programa').select('nombre, descripcion, tipo').eq('id', nextClaseIdToPush).single();
                             if (err2) throw err2;
                             if (targetClase) {
                               const { error: err3 } = await supabase.from('horarios').update({ titulo: targetClase.nombre, descripcion: targetClase.descripcion }).eq('id', slot.horario_id);
                               if (err3) throw err3;
                               
                               if (targetClase.tipo === 'prueba') {
                                 const { data: existingPrueba } = await supabase.from('pruebas').select('id').eq('horario_id', slot.horario_id).single();
                                 if (existingPrueba) {
                                     const { error: err4 } = await supabase.from('pruebas').update({ clase_id: nextClaseIdToPush, nombre: targetClase.nombre, estado: 'pendiente', nota: null, observaciones: null }).eq('id', existingPrueba.id);
                                     if (err4) throw err4;
                                 } else {
                                     const { error: err5 } = await supabase.from('pruebas').insert({ horario_id: slot.horario_id, alumno_id: prueba.alumno_id, profesor_id: prueba.profesor_id, clase_id: nextClaseIdToPush, nombre: targetClase.nombre, estado: 'pendiente', fecha: slot.horarios.fecha });
                                     if (err5) throw err5;
                                 }
                               } else {
                                 const { error: err6 } = await supabase.from('pruebas').delete().eq('horario_id', slot.horario_id);
                                 if (err6 && err6.code !== 'PGRST116') throw err6;
                               }
                             }
                           } else {
                             const { error: err7 } = await supabase.from('pruebas').delete().eq('horario_id', slot.horario_id);
                             if (err7 && err7.code !== 'PGRST116') throw err7;
                           }
                           nextClaseIdToPush = oldClaseIdInSlot;
                         }
                         needs_scheduling = true;

                     } else if (wasFailing && isNowPassingOrEmpty) {
                         // === SHIFT UP (PULL / ROLLBACK) ===
                         // Only rollback if the immediate next slot currently contains the cloned prueba
                         if (futureClasses[0].clase_id === prueba.clase_id) {
                            for (let i = 0; i < futureClasses.length - 1; i++) {
                               const currSlot = futureClasses[i];
                               const nextSlot = futureClasses[i+1];
                               
                               const { error: err1 } = await supabase.from('horarios_programa').update({ clase_id: nextSlot.clase_id }).eq('id', currSlot.id);
                               if (err1) throw err1;
                               
                               if (nextSlot.clase_id) {
                                  const { data: tg, error: err2 } = await supabase.from('clases_programa').select('nombre, descripcion, tipo').eq('id', nextSlot.clase_id).single();
                                  if (err2) throw err2;
                                  if (tg) {
                                     const { error: err3 } = await supabase.from('horarios').update({ titulo: tg.nombre, descripcion: tg.descripcion }).eq('id', currSlot.horario_id);
                                     if (err3) throw err3;
                                     if (tg.tipo === 'prueba') {
                                        const { data: exP } = await supabase.from('pruebas').select('id').eq('horario_id', currSlot.horario_id).single();
                                        if (exP) {
                                           const { error: err4 } = await supabase.from('pruebas').update({ clase_id: nextSlot.clase_id, nombre: tg.nombre, estado: 'pendiente', nota: null, observaciones: null }).eq('id', exP.id);
                                           if (err4) throw err4;
                                        } else {
                                           const { error: err5 } = await supabase.from('pruebas').insert({ horario_id: currSlot.horario_id, alumno_id: prueba.alumno_id, profesor_id: prueba.profesor_id, clase_id: nextSlot.clase_id, nombre: tg.nombre, estado: 'pendiente', fecha: currSlot.horarios.fecha });
                                           if (err5) throw err5;
                                        }
                                     } else {
                                        await supabase.from('pruebas').delete().eq('horario_id', currSlot.horario_id);
                                     }
                                  }
                               } else {
                                  await supabase.from('pruebas').delete().eq('horario_id', currSlot.horario_id);
                               }
                            }
                            
                            // Last slot becomes empty safely
                            const lastSlot = futureClasses[futureClasses.length - 1];
                            const { error: eF1 } = await supabase.from('horarios_programa').update({ clase_id: null }).eq('id', lastSlot.id);
                            if (eF1) throw eF1;
                            const { error: eF2 } = await supabase.from('horarios').update({ titulo: 'Espacio disponible', descripcion: null }).eq('id', lastSlot.horario_id);
                            if (eF2) throw eF2;
                            await supabase.from('pruebas').delete().eq('horario_id', lastSlot.horario_id);
                         }
                     }
                 } else if (isNowFailing && wasPassingOrEmpty) {
                     needs_scheduling = true;
                 }
               }
            }
          }
        }
      }
    } catch (e) {
      console.error('Error in schedule shifting bi-directional layer:', e);
      needs_scheduling = true;
    }
  }

  return NextResponse.json({ ...updated, needs_scheduling });
}
