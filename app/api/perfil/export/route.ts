import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/perfil/export — Portabilidad de datos (Ley 21.719).
 *
 * Devuelve, en formato JSON estructurado, los datos personales del usuario
 * autenticado para que pueda descargarlos. Sólo incluye datos propios (filtrados
 * por su id); las consultas usan el cliente con RLS, de modo que el usuario sólo
 * puede exportar lo que legítimamente le pertenece.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Perfil base.
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Ficha extendida (alumnos / lectores).
  const { data: alumnoExtra } = await supabase
    .from('alumnos_extra')
    .select('*')
    .eq('alumno_id', user.id)
    .maybeSingle();

  // Datos propios de uso del servicio. Cada consulta está acotada por el id del
  // usuario y, además, protegida por RLS. Si una tabla no aplica a su rol, la
  // consulta simplemente devuelve vacío.
  const [asistencia, solicitudes, notificaciones] = await Promise.all([
    supabase.from('asistencia').select('*').eq('alumno_id', user.id),
    supabase.from('solicitudes_cambio_horario').select('*').eq('alumno_id', user.id),
    supabase.from('notificaciones').select('*').eq('alumno_id', user.id),
  ]);

  const exportData = {
    exportado_el: new Date().toISOString(),
    aviso:
      'Copia de tus datos personales almacenados en la plataforma (Ley 21.719, derecho de portabilidad).',
    cuenta: {
      id: user.id,
      email: user.email,
      creada_el: user.created_at,
      ultimo_acceso: user.last_sign_in_at,
    },
    perfil: profile ?? null,
    ficha_alumno: alumnoExtra ?? null,
    asistencia: asistencia.data ?? [],
    solicitudes_cambio_horario: solicitudes.data ?? [],
    notificaciones: notificaciones.data ?? [],
  };

  const filename = `mis-datos-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
