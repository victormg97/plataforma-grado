-- ── 082: Fix get_admin_prefetch — pagos_anual correcto + filtro notificaciones descartadas ──

CREATE OR REPLACE FUNCTION public.get_admin_prefetch(p_admin_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := COALESCE(p_admin_id, auth.uid());
  v_today DATE := current_date;
  v_week_start DATE := date_trunc('week', current_date)::date;
  v_week_end DATE := date_trunc('week', current_date)::date + 6;
  v_month_start DATE := date_trunc('month', current_date)::date;
  v_month_end DATE := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  v_year INT := EXTRACT(YEAR FROM current_date)::int;
  v_month INT := EXTRACT(MONTH FROM current_date)::int;
  v_stats JSONB; v_alumnos JSONB; v_profesores JSONB;
  v_notif_dash JSONB; v_notif_full JSONB;
  v_clases_hoy JSONB; v_horarios_cal JSONB; v_bloqueos JSONB;
  v_programas JSONB; v_pagos_mes JSONB; v_pagos_anual JSONB; v_recursos JSONB;
BEGIN
  -- 1. Stats
  SELECT jsonb_build_object(
    'total_alumnos',        (SELECT count(*) FROM profiles WHERE rol='alumno' AND activo=true),
    'total_profesores',     (SELECT count(*) FROM profiles WHERE rol='profesor' AND activo=true),
    'clases_hoy',           (SELECT count(*) FROM horarios WHERE fecha=v_today AND activo=true),
    'clases_semana',        (SELECT count(*) FROM horarios WHERE fecha BETWEEN v_week_start AND v_week_end AND activo=true),
    'clases_mes',           (SELECT count(*) FROM horarios WHERE fecha BETWEEN v_month_start AND v_month_end AND activo=true),
    'pendientes_confirmar', (SELECT count(*) FROM asistencia WHERE estado='pendiente'),
    'estado_pendientes',    (SELECT count(*) FROM horarios h WHERE h.activo=true AND COALESCE((SELECT a.estado FROM asistencia a WHERE a.horario_id=h.id LIMIT 1),'pendiente')='pendiente'),
    'estado_confirmadas',   (SELECT count(*) FROM horarios h WHERE h.activo=true AND (SELECT a.estado FROM asistencia a WHERE a.horario_id=h.id LIMIT 1)='confirmado'),
    'estado_canceladas',    (SELECT count(*) FROM horarios h WHERE h.activo=true AND (SELECT a.estado FROM asistencia a WHERE a.horario_id=h.id LIMIT 1)='cancelado')
  ) INTO v_stats;

  -- 2. Alumnos
  WITH pu AS (SELECT DISTINCT user_id FROM invitations WHERE used=false AND expires_at>now())
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.nombre),'[]'::jsonb) INTO v_alumnos FROM (
    SELECT p.id,p.nombre,p.apellido,p.apellido_materno,p.email,p.telefono,p.avatar_url,p.activo,
      ae.profesor_id,prof.nombre AS profesor_nombre,prof.apellido AS profesor_apellido,
      ae.universidad,ae.año_ingreso,ae.notas,COALESCE(ae.paso_prueba,false) AS paso_prueba,ae.fecha_prueba,
      CASE WHEN NOT p.activo THEN 'bloqueado' WHEN COALESCE(ae.paso_prueba,false) THEN 'graduado' WHEN pu.user_id IS NOT NULL THEN 'pendiente' ELSE 'activo' END AS estado
    FROM profiles p LEFT JOIN alumnos_extra ae ON ae.alumno_id=p.id LEFT JOIN profiles prof ON prof.id=ae.profesor_id LEFT JOIN pu ON pu.user_id=p.id WHERE p.rol='alumno'
  ) s;

  -- 3. Profesores
  WITH pu AS (SELECT DISTINCT user_id FROM invitations WHERE used=false AND expires_at>now()),
  ac AS (SELECT profesor_id,COUNT(*) AS total FROM alumnos_extra WHERE profesor_id IS NOT NULL GROUP BY profesor_id)
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.nombre),'[]'::jsonb) INTO v_profesores FROM (
    SELECT p.id,p.nombre,p.apellido,p.apellido_materno,p.email,p.telefono,p.avatar_url,p.activo,p.rol::TEXT AS rol,p.puede_crear_alumno,
      COALESCE(ac.total,0) AS alumnos_count,CASE WHEN pu.user_id IS NOT NULL THEN 'Pendiente' ELSE 'Activo' END AS estado_cuenta
    FROM profiles p LEFT JOIN pu ON pu.user_id=p.id LEFT JOIN ac ON ac.profesor_id=p.id WHERE p.rol IN ('profesor','admin')
  ) s;

  -- 4. Notificaciones dashboard (top 10, excluyendo descartadas por este admin)
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY (s.created_at) DESC),'[]'::jsonb) INTO v_notif_dash FROM (
    SELECT n.id,n.destinatario_id,n.tipo,n.mensaje,n.horario_id,n.alumno_id,n.programa_id,n.solicitud_id,n.created_at,
      CASE WHEN h.id IS NOT NULL THEN jsonb_build_object('id',h.id,'fecha',h.fecha,'hora_inicio',h.hora_inicio,'hora_fin',h.hora_fin) ELSE NULL END AS horario,
      CASE WHEN al.id IS NOT NULL THEN jsonb_build_object('id',al.id,'nombre',al.nombre,'apellido',al.apellido) ELSE NULL END AS alumno,
      CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('id',d.id,'nombre',d.nombre,'apellido',d.apellido,'rol',d.rol) ELSE NULL END AS destinatario,
      (EXISTS(SELECT 1 FROM notificaciones_vistas_admin nva WHERE nva.notificacion_id=n.id AND nva.admin_id=v_admin_id)) AS leida
    FROM notificaciones n
    LEFT JOIN horarios h ON h.id=n.horario_id
    LEFT JOIN profiles al ON al.id=n.alumno_id
    LEFT JOIN profiles d ON d.id=n.destinatario_id
    WHERE NOT EXISTS(
      SELECT 1 FROM notificaciones_descartadas_admin nda
      WHERE nda.notificacion_id=n.id AND nda.admin_id=v_admin_id
    )
    ORDER BY n.created_at DESC LIMIT 10
  ) s;

  -- 5. Notificaciones full view (hasta 500, excluyendo descartadas, con solicitud join)
  SELECT jsonb_build_object(
    'data', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY (s.created_at) DESC) FROM (
      SELECT n.id,n.destinatario_id,n.tipo,n.mensaje,n.horario_id,n.alumno_id,n.programa_id,n.solicitud_id,n.created_at,
        CASE WHEN h.id IS NOT NULL THEN jsonb_build_object('id',h.id,'fecha',h.fecha,'hora_inicio',h.hora_inicio,'hora_fin',h.hora_fin) ELSE NULL END AS horario,
        CASE WHEN al.id IS NOT NULL THEN jsonb_build_object('id',al.id,'nombre',al.nombre,'apellido',al.apellido) ELSE NULL END AS alumno,
        CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('id',d.id,'nombre',d.nombre,'apellido',d.apellido,'rol',d.rol) ELSE NULL END AS destinatario,
        CASE WHEN so.id IS NOT NULL THEN jsonb_build_object('id',so.id,'alumno_id',so.alumno_id,'profesor_id',so.profesor_id,'horario_original_id',so.horario_original_id,'fecha_propuesta',so.fecha_propuesta,'hora_inicio_propuesta',so.hora_inicio_propuesta,'hora_fin_propuesta',so.hora_fin_propuesta,'estado',so.estado,'motivo_rechazo',so.motivo_rechazo,'nuevo_horario_id',so.nuevo_horario_id,'nota_alumno',so.nota_alumno,'created_at',so.created_at,'updated_at',so.updated_at) ELSE NULL END AS solicitud,
        (EXISTS(SELECT 1 FROM notificaciones_vistas_admin nva WHERE nva.notificacion_id=n.id AND nva.admin_id=v_admin_id)) AS leida
      FROM notificaciones n
      LEFT JOIN horarios h ON h.id=n.horario_id
      LEFT JOIN profiles al ON al.id=n.alumno_id
      LEFT JOIN profiles d ON d.id=n.destinatario_id
      LEFT JOIN solicitudes_cambio_horario so ON so.id=n.solicitud_id
      WHERE NOT EXISTS(
        SELECT 1 FROM notificaciones_descartadas_admin nda
        WHERE nda.notificacion_id=n.id AND nda.admin_id=v_admin_id
      )
      ORDER BY n.created_at DESC LIMIT 500
    ) s),'[]'::jsonb),
    'total',(SELECT count(*) FROM notificaciones WHERE NOT EXISTS(
      SELECT 1 FROM notificaciones_descartadas_admin nda
      WHERE nda.notificacion_id=notificaciones.id AND nda.admin_id=v_admin_id
    )),
    'page',1,'page_size',500,'total_pages',1
  ) INTO v_notif_full;

  -- 6. Clases hoy
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.hora_inicio),'[]'::jsonb) INTO v_clases_hoy FROM (
    SELECT h.id,h.titulo,h.fecha,h.hora_inicio,h.hora_fin,h.activo,
      jsonb_build_object('nombre',al.nombre,'apellido',al.apellido) AS alumno,
      jsonb_build_object('nombre',pr.nombre,'apellido',pr.apellido) AS profesor,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('estado',a.estado)),'[]'::jsonb) FROM asistencia a WHERE a.horario_id=h.id) AS asistencia
    FROM horarios h LEFT JOIN profiles al ON al.id=h.alumno_id LEFT JOIN profiles pr ON pr.id=h.profesor_id WHERE h.fecha=v_today AND h.activo=true
  ) s;

  -- 7. Todos los horarios activos para CalendarioAdmin
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.fecha ASC),'[]'::jsonb) INTO v_horarios_cal FROM (
    SELECT h.*,
      (SELECT COALESCE(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM asistencia a WHERE a.horario_id=h.id) AS asistencia,
      (SELECT to_jsonb(al) FROM (SELECT p.id,p.nombre,p.apellido,p.email,p.avatar_url,p.telefono,p.activo,p.rol FROM profiles p WHERE p.id=h.alumno_id) al) AS alumno,
      (SELECT jsonb_build_object('id',pr.id,'nombre',pr.nombre,'apellido',pr.apellido,'avatar_url',pr.avatar_url) FROM profiles pr WHERE pr.id=h.profesor_id) AS profesor,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',pu.id,'nota',pu.nota)),'[]'::jsonb) FROM pruebas pu WHERE pu.horario_id=h.id) AS pruebas
    FROM horarios h WHERE h.activo=true
  ) s;

  -- 8. Bloqueos activos
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.fecha ASC, s.hora_inicio ASC),'[]'::jsonb) INTO v_bloqueos FROM (
    SELECT bh.*,
      jsonb_build_object('id',pr.id,'nombre',pr.nombre,'apellido',pr.apellido,'avatar_url',pr.avatar_url) AS profesor
    FROM bloqueos_horario bh
    LEFT JOIN profiles pr ON pr.id=bh.profesor_id
    WHERE bh.activo=true
  ) s;

  -- 9. Programas (todos)
  SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]'::jsonb) INTO v_programas FROM (
    SELECT pc.id,pc.nombre,pc.descripcion,pc.estado,pc.visibilidad,pc.profesor_id,pc.created_by,pc.created_at,pc.updated_at,
      CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('id',pr.id,'nombre',pr.nombre,'apellido',pr.apellido,'avatar_url',pr.avatar_url) ELSE NULL END AS profesor,
      CASE WHEN cb.id IS NOT NULL THEN jsonb_build_object('id',cb.id,'nombre',cb.nombre,'apellido',cb.apellido) ELSE NULL END AS creado_por,
      (SELECT count(*) FROM clases_programa cp WHERE cp.programa_id=pc.id)::int AS total_clases,
      (SELECT count(*) FROM asignaciones_programa ap WHERE ap.programa_id=pc.id AND ap.estado='activo')::int AS total_asignados,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',pp_pr.id,'nombre',pp_pr.nombre,'apellido',pp_pr.apellido,'avatar_url',pp_pr.avatar_url)),'[]'::jsonb) FROM programa_profesores pp JOIN profiles pp_pr ON pp_pr.id=pp.profesor_id WHERE pp.programa_id=pc.id) AS profesores_asignados
    FROM programas_clases pc LEFT JOIN profiles pr ON pr.id=pc.profesor_id LEFT JOIN profiles cb ON cb.id=pc.created_by ORDER BY pc.created_at DESC
  ) s;

  -- 10. Pagos mes actual
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.nombre),'[]'::jsonb) INTO v_pagos_mes FROM (
    SELECT p.id AS alumno_id,p.nombre,p.apellido,p.avatar_url,p.activo,COALESCE(ae.paso_prueba,false) AS paso_prueba,ae.profesor_id,
      prof.nombre AS profesor_nombre,prof.apellido AS profesor_apellido,
      pg.id AS pago_id,pg.estado AS pago_estado,pg.monto_pagado AS pago_monto,pg.fecha_pago AS pago_fecha
    FROM profiles p
    LEFT JOIN alumnos_extra ae ON ae.alumno_id=p.id
    LEFT JOIN profiles prof ON prof.id=ae.profesor_id
    LEFT JOIN pagos pg ON pg.alumno_id=p.id AND pg.anio=v_year AND pg.mes=v_month
    WHERE p.rol='alumno' AND p.activo=true
  ) s;

  -- 11. Pagos resumen anual (por alumno, con pagos de cada mes)
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.nombre),'[]'::jsonb) INTO v_pagos_anual FROM (
    SELECT p.id AS alumno_id,p.nombre,p.apellido,p.activo,COALESCE(ae.paso_prueba,false) AS paso_prueba,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('mes',m.n,'estado',pg2.estado,'monto_pagado',pg2.monto_pagado) ORDER BY m.n),'[]'::jsonb)
       FROM generate_series(1,12) AS m(n)
       LEFT JOIN pagos pg2 ON pg2.alumno_id=p.id AND pg2.anio=v_year AND pg2.mes=m.n) AS pagos
    FROM profiles p
    LEFT JOIN alumnos_extra ae ON ae.alumno_id=p.id
    WHERE p.rol='alumno' AND p.activo=true
  ) s;

  -- 12. Recursos
  v_recursos := get_recursos_for_user();

  RETURN jsonb_build_object(
    'stats',               v_stats,
    'alumnos',             v_alumnos,
    'profesores',          v_profesores,
    'notificaciones',      v_notif_dash,
    'notificaciones_full', v_notif_full,
    'clases_hoy',          v_clases_hoy,
    'horarios_calendario', v_horarios_cal,
    'bloqueos',            v_bloqueos,
    'programas',           v_programas,
    'pagos_mes',           v_pagos_mes,
    'pagos_anual',         v_pagos_anual,
    'recursos',            v_recursos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_prefetch(UUID) TO authenticated;
