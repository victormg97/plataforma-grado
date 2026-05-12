import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const soloNoLeidas = searchParams.get('no_leidas') === 'true';

  // Pagination params
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || searchParams.get('limit') || '20', 10)));

  // Filter params
  const tipo = searchParams.get('tipo');
  const fechaDesde = searchParams.get('fecha_desde');
  const fechaHasta = searchParams.get('fecha_hasta');
  const alumnoId = searchParams.get('alumno_id');

  // Calculate range for pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('notificaciones')
    .select('*, alumno:alumno_id(id, nombre, apellido), horario:horario_id(id, fecha, hora_inicio, hora_fin, titulo, descripcion), destinatario:destinatario_id(id, nombre, apellido, rol), solicitud:solicitud_id(id, alumno_id, profesor_id, horario_original_id, fecha_propuesta, hora_inicio_propuesta, hora_fin_propuesta, estado, motivo_rechazo, nuevo_horario_id, nota_alumno, created_at, updated_at)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  // Admin sees ALL notifications, everyone else sees only their own
  if (profile.rol !== 'admin') {
    query = query.eq('destinatario_id', user.id);
  }

  if (soloNoLeidas) {
    query = query.eq('leida', false);
  }

  // Filter by notification type
  if (tipo) {
    query = query.eq('tipo', tipo as Database['public']['Enums']['tipo_notificacion']);
  }

  // Filter by date range (based on created_at)
  if (fechaDesde) {
    query = query.gte('created_at', fechaDesde);
  }
  if (fechaHasta) {
    // Include the entire end date by appending end-of-day time if only a date is provided
    const hastaValue = fechaHasta.includes('T') ? fechaHasta : `${fechaHasta}T23:59:59.999Z`;
    query = query.lte('created_at', hastaValue);
  }

  // Filter by alumno_id (admin only)
  if (alumnoId && profile.rol === 'admin') {
    query = query.eq('alumno_id', alumnoId);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Get distinct notification types for this user (for smart filter population)
  let tiposQuery = supabase
    .from('notificaciones')
    .select('tipo');

  if (profile.rol !== 'admin') {
    tiposQuery = tiposQuery.eq('destinatario_id', user.id);
  }

  const { data: tiposData } = await tiposQuery;
  const availableTipos = tiposData
    ? [...new Set(tiposData.map((t) => t.tipo))].sort()
    : [];

  return NextResponse.json({
    data: data ?? [],
    total,
    page,
    page_size: pageSize,
    total_pages: totalPages,
    available_tipos: availableTipos,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json();
  const { ids, marcar_todo } = body;

  if (marcar_todo) {
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('destinatario_id', user.id)
      .eq('leida', false);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (Array.isArray(ids) && ids.length > 0) {
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .in('id', ids)
      .eq('destinatario_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const idsParam = searchParams.get('ids');

  // Batch delete: ?ids=id1,id2,id3
  if (idsParam) {
    const ids = idsParam.split(',').filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ error: 'Se requiere al menos un id' }, { status: 400 });

    const { error } = await supabase
      .from('notificaciones')
      .delete()
      .in('id', ids)
      .eq('destinatario_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Single delete: ?id=xxx
  if (!id) return NextResponse.json({ error: 'Se requiere id' }, { status: 400 });

  // RLS ensures destinatario_id = auth.uid(), but we double-check to be explicit
  const { error } = await supabase
    .from('notificaciones')
    .delete()
    .eq('id', id)
    .eq('destinatario_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
