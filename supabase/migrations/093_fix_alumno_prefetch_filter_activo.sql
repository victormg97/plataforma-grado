-- ── 093: Fix get_alumno_prefetch — filter clases by h.activo = true ──────────
-- Bug: The 'clases' subquery in get_alumno_prefetch did NOT filter by h.activo,
-- so deleted/inactive horarios appeared in the SSR prefetch cache for ~30s
-- until the client-side get_alumno_dashboard (which does filter) replaced them.
--
-- Also adds cancellation_deadline_hours to the profesor object for consistency
-- with get_alumno_dashboard (migration 073).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_alumno_prefetch(p_alumno_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sort_by    TEXT := 'created_at_desc';
  v_asistencia JSONB; v_ficha JSONB; v_notif_full JSONB; v_recursos JSONB;
BEGIN
  SELECT COALESCE(urp.sort_by, 'created_at_desc') INTO v_sort_by
    FROM public.user_recursos_preferences urp WHERE urp.user_id = p_alumno_id;

  -- 1. Dashboard del alumno
  SELECT jsonb_build_object(
    'clases',(
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id',a.id,'estado',a.estado,'nota_alumno',a.nota_alumno,'nuevo_horario_id',a.nuevo_horario_id,
          'horario',jsonb_build_object('id',h.id,'titulo',h.titulo,'descripcion',h.descripcion,'fecha',h.fecha,'hora_inicio',h.hora_inicio,'hora_fin',h.hora_fin,'activo',h.activo,
            'profesor',(SELECT jsonb_build_object('id',p.id,'nombre',p.nombre,'apellido',p.apellido,'avatar_url',p.avatar_url,'cancellation_deadline_hours',p.cancellation_deadline_hours) FROM profiles p WHERE p.id=h.profesor_id)
          )
        ) ORDER BY h.fecha DESC,h.hora_inicio DESC
      ),'[]'::jsonb)
      FROM asistencia a INNER JOIN horarios h ON h.id=a.horario_id
      WHERE a.alumno_id=p_alumno_id AND h.activo = true
    ),
    'proxima_clase',(
      SELECT to_jsonb(t) FROM (
        SELECT a.id,a.estado,a.nota_alumno,
          jsonb_build_object('id',h.id,'titulo',h.titulo,'fecha',h.fecha,'hora_inicio',h.hora_inicio,'hora_fin',h.hora_fin,'descripcion',h.descripcion,
            'profesor',(SELECT jsonb_build_object('id',p.id,'nombre',p.nombre,'apellido',p.apellido,'cancellation_deadline_hours',p.cancellation_deadline_hours) FROM profiles p WHERE p.id=h.profesor_id)
          ) AS horario
        FROM asistencia a INNER JOIN horarios h ON h.id=a.horario_id
        WHERE a.alumno_id=p_alumno_id AND h.activo=true
          AND (h.fecha::text || 'T' || h.hora_fin::text)::timestamptz > now()
        ORDER BY h.fecha ASC,h.hora_inicio ASC LIMIT 1
      ) t
    ),
    'stats',(
      SELECT jsonb_build_object('total',count(*),'confirmadas',count(*) FILTER(WHERE a.estado='confirmado'),'pendientes',count(*) FILTER(WHERE a.estado='pendiente'),'canceladas',count(*) FILTER(WHERE a.estado='cancelado'),'no_asistio',count(*) FILTER(WHERE a.estado='no_asistio'))
      FROM asistencia a INNER JOIN horarios h ON h.id=a.horario_id WHERE a.alumno_id=p_alumno_id AND h.activo=true
    )
  ) INTO v_asistencia;

  -- 2. Ficha del alumno
  v_ficha := get_alumno_ficha(p_alumno_id, 50, p_alumno_id);

  -- 3. Notificaciones full
  SELECT jsonb_build_object(
    'data', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY (s.created_at) DESC) FROM (
      SELECT n.id,n.destinatario_id,n.tipo,n.mensaje,n.horario_id,n.alumno_id,n.programa_id,n.solicitud_id,n.created_at,
        CASE WHEN h.id IS NOT NULL THEN jsonb_build_object('id',h.id,'fecha',h.fecha,'hora_inicio',h.hora_inicio,'hora_fin',h.hora_fin) ELSE NULL END AS horario,
        CASE WHEN al.id IS NOT NULL THEN jsonb_build_object('id',al.id,'nombre',al.nombre,'apellido',al.apellido) ELSE NULL END AS alumno,
        CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('id',d.id,'nombre',d.nombre,'apellido',d.apellido,'rol',d.rol) ELSE NULL END AS destinatario,
        CASE WHEN so.id IS NOT NULL THEN jsonb_build_object('id',so.id,'alumno_id',so.alumno_id,'profesor_id',so.profesor_id,'horario_original_id',so.horario_original_id,'fecha_propuesta',so.fecha_propuesta,'hora_inicio_propuesta',so.hora_inicio_propuesta,'hora_fin_propuesta',so.hora_fin_propuesta,'estado',so.estado,'motivo_rechazo',so.motivo_rechazo,'nuevo_horario_id',so.nuevo_horario_id,'nota_alumno',so.nota_alumno,'created_at',so.created_at,'updated_at',so.updated_at) ELSE NULL END AS solicitud,
        n.leida
      FROM notificaciones n LEFT JOIN horarios h ON h.id=n.horario_id LEFT JOIN profiles al ON al.id=n.alumno_id
      LEFT JOIN profiles d ON d.id=n.destinatario_id LEFT JOIN solicitudes_cambio_horario so ON so.id=n.solicitud_id
      WHERE n.destinatario_id=p_alumno_id ORDER BY n.created_at DESC LIMIT 500
    ) s),'[]'::jsonb),
    'total',(SELECT count(*) FROM notificaciones WHERE destinatario_id=p_alumno_id),
    'page',1,'page_size',500,'total_pages',1
  ) INTO v_notif_full;

  -- 4. Recursos (con sort pre-aplicado)
  v_recursos := get_recursos_for_user(v_sort_by);

  RETURN jsonb_build_object(
    'asistencia',         v_asistencia,
    'ficha_perfil',       v_ficha,
    'notificaciones_full',v_notif_full,
    'recursos',           v_recursos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_alumno_prefetch(UUID) TO authenticated;
