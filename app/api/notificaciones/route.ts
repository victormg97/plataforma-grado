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

  const isAdmin = profile.rol === 'admin';
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

  if (isAdmin) {
    // ── Admin: fetch all notifications + join admin read status ──────────────
    // We fetch notificaciones_vistas_admin for this admin in a single join
    // so we can compute `leida` (from the admin's perspective) client-side.
    let query = supabase
      .from('notificaciones')
      .select(
        `*, 
        alumno:alumno_id(id, nombre, apellido), 
        horario:horario_id(id, fecha, hora_inicio, hora_fin, titulo, descripcion), 
        destinatario:destinatario_id(id, nombre, apellido, rol), 
        solicitud:solicitud_id(id, alumno_id, profesor_id, horario_original_id, fecha_propuesta, hora_inicio_propuesta, hora_fin_propuesta, estado, motivo_rechazo, nuevo_horario_id, nota_alumno, created_at, updated_at),
        notificaciones_vistas_admin!left(admin_id)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    // Filter by notification type
    if (tipo) {
      query = query.eq('tipo', tipo as Database['public']['Enums']['tipo_notificacion']);
    }
    if (fechaDesde) {
      query = query.gte('created_at', fechaDesde);
    }
    if (fechaHasta) {
      const hastaValue = fechaHasta.includes('T') ? fechaHasta : `${fechaHasta}T23:59:59.999Z`;
      query = query.lte('created_at', hastaValue);
    }
    if (alumnoId) {
      query = query.eq('alumno_id', alumnoId);
    }

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Map `leida` to whether this admin has a vista record for each notification
    // The join returns an array (could be [] or [{admin_id}]) due to the left join.
    const mappedData = (data ?? []).map((n) => {
      const vistas = n.notificaciones_vistas_admin as { admin_id: string }[] | null;
      const leida = Array.isArray(vistas) && vistas.some((v) => v.admin_id === user.id);
      // Remove the join artifact from the response shape
      const { notificaciones_vistas_admin: _, ...rest } = n as typeof n & { notificaciones_vistas_admin: unknown };
      return { ...rest, leida };
    });

    // soloNoLeidas filter (applied after mapping)
    const filteredData = soloNoLeidas ? mappedData.filter((n) => !n.leida) : mappedData;

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    // Available tipos for filter dropdown
    const { data: tiposData } = await supabase.from('notificaciones').select('tipo');
    const availableTipos = tiposData
      ? [...new Set(tiposData.map((t) => t.tipo))].sort()
      : [];

    return NextResponse.json({
      data: filteredData,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      available_tipos: availableTipos,
    });
  }

  // ── Non-admin: original behavior ─────────────────────────────────────────
  let query = supabase
    .from('notificaciones')
    .select('*, alumno:alumno_id(id, nombre, apellido), horario:horario_id(id, fecha, hora_inicio, hora_fin, titulo, descripcion), destinatario:destinatario_id(id, nombre, apellido, rol), solicitud:solicitud_id(id, alumno_id, profesor_id, horario_original_id, fecha_propuesta, hora_inicio_propuesta, hora_fin_propuesta, estado, motivo_rechazo, nuevo_horario_id, nota_alumno, created_at, updated_at)', { count: 'exact' })
    .eq('destinatario_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (soloNoLeidas) {
    query = query.eq('leida', false);
  }
  if (tipo) {
    query = query.eq('tipo', tipo as Database['public']['Enums']['tipo_notificacion']);
  }
  if (fechaDesde) {
    query = query.gte('created_at', fechaDesde);
  }
  if (fechaHasta) {
    const hastaValue = fechaHasta.includes('T') ? fechaHasta : `${fechaHasta}T23:59:59.999Z`;
    query = query.lte('created_at', hastaValue);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const { data: tiposData } = await supabase
    .from('notificaciones')
    .select('tipo')
    .eq('destinatario_id', user.id);
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const isAdmin = profile.rol === 'admin';
  const body = await request.json();
  const { ids, marcar_todo } = body;

  if (isAdmin) {
    // ── Admin: upsert into notificaciones_vistas_admin ──────────────────────
    if (marcar_todo) {
      // Fetch all notification IDs the admin can see
      const { data: allNotifs, error: fetchError } = await supabase
        .from('notificaciones')
        .select('id');
      if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

      if (allNotifs && allNotifs.length > 0) {
        const rows = allNotifs.map((n) => ({ notificacion_id: n.id, admin_id: user.id }));
        const { error } = await supabase
          .from('notificaciones_vistas_admin')
          .upsert(rows, { onConflict: 'notificacion_id,admin_id', ignoreDuplicates: true });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      const rows = ids.map((id: string) => ({ notificacion_id: id, admin_id: user.id }));
      const { error } = await supabase
        .from('notificaciones_vistas_admin')
        .upsert(rows, { onConflict: 'notificacion_id,admin_id', ignoreDuplicates: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  // ── Non-admin: original behavior ─────────────────────────────────────────
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const isAdmin = profile.rol === 'admin';
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const idsParam = searchParams.get('ids');

  if (isAdmin) {
    // ── Admin: delete only their own vista records (not the notification itself) ──
    // Admins can't delete notifications they don't own; they can only clear their
    // read-status entries. If you want admins to hard-delete notifications,
    // remove this guard — but that would affect the original recipient too.
    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean);
      if (ids.length === 0) return NextResponse.json({ error: 'Se requiere al menos un id' }, { status: 400 });
      const { error } = await supabase
        .from('notificaciones_vistas_admin')
        .delete()
        .in('notificacion_id', ids)
        .eq('admin_id', user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    if (!id) return NextResponse.json({ error: 'Se requiere id' }, { status: 400 });
    const { error } = await supabase
      .from('notificaciones_vistas_admin')
      .delete()
      .eq('notificacion_id', id)
      .eq('admin_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Non-admin: original behavior ─────────────────────────────────────────
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

  const { error } = await supabase
    .from('notificaciones')
    .delete()
    .eq('id', id)
    .eq('destinatario_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
