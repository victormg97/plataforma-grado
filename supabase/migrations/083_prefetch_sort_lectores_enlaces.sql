-- ── 083: Prefetch — sort de recursos pre-aplicado + lectores + enlaces ────────
--
-- Cambios:
--   1. get_recursos_for_user(p_sort_by) — acepta el sort preferido del usuario
--      y aplica el ORDER directamente en SQL. El prefetch lo lee de
--      user_recursos_preferences antes de llamar a la función.
--   2. get_admin_prefetch — agrega:
--        · lectores        (key 'lectores')
--        · enlaces         (key 'enlaces')
--        · lee sort_by del usuario y lo pasa a get_recursos_for_user
--   3. get_profesor_prefetch — pasa sort_by a get_recursos_for_user
--   4. get_alumno_prefetch   — pasa sort_by a get_recursos_for_user
--   5. get_lector_prefetch   — pasa sort_by a get_recursos_for_user
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. get_recursos_for_user — ahora acepta p_sort_by
-- ═══════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_recursos_for_user();
DROP FUNCTION IF EXISTS public.get_recursos_for_user(text);

CREATE OR REPLACE FUNCTION public.get_recursos_for_user(
  p_sort_by TEXT DEFAULT 'created_at_desc'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_rol     TEXT;
BEGIN
  SELECT rol INTO v_rol FROM public.profiles WHERE id = v_user_id;

  -- ── ADMIN ──────────────────────────────────────────────────────────────────
  IF v_rol = 'admin' THEN
    RETURN (
      SELECT jsonb_build_object(
        'recursos', COALESCE((
          SELECT jsonb_agg(to_jsonb(r))
          FROM (
            SELECT rc.*, p.nombre || ' ' || p.apellido AS uploader_nombre,
              (SELECT COUNT(*) FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
            FROM public.recursos_compartidos rc
            JOIN public.profiles p ON p.id = rc.subido_por
            ORDER BY
              CASE p_sort_by
                WHEN 'created_at_asc' THEN rc.created_at END ASC,
              CASE p_sort_by
                WHEN 'created_at_desc' THEN rc.created_at END DESC,
              CASE p_sort_by
                WHEN 'nombre_asc'  THEN rc.titulo
                WHEN 'nombre_desc' THEN rc.titulo
                WHEN 'tipo_asc'    THEN rc.tipo  END ASC,
              CASE p_sort_by
                WHEN 'nombre_desc' THEN rc.titulo END DESC,
              rc.created_at DESC
          ) r
        ), '[]'::jsonb),
        'carpetas', COALESCE((
          SELECT jsonb_agg(to_jsonb(c))
          FROM (
            SELECT cr.*,
              p.nombre || ' ' || p.apellido AS creador_nombre,
              public.count_recursos_in_folder(cr.id) AS recursive_recursos_count,
              EXISTS (
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT 1 FROM public.recursos_compartidos rc2
                WHERE rc2.carpeta_id IN (SELECT id FROM ft) AND rc2.para_todos = true
              ) AS para_todos_efectivo,
              EXISTS (
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT 1 FROM public.recursos_compartidos rc2
                WHERE rc2.carpeta_id IN (SELECT id FROM ft) AND rc2.para_todos_app = true
              ) AS para_todos_app_efectivo,
              COALESCE((
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT jsonb_agg(DISTINCT ra2.alumno_id)
                FROM public.recursos_acceso ra2
                JOIN public.recursos_compartidos rc3 ON rc3.id = ra2.recurso_id
                WHERE rc3.carpeta_id IN (SELECT id FROM ft)
              ), '[]'::jsonb) AS alumno_ids_efectivos
            FROM public.carpetas_recursos cr
            JOIN public.profiles p ON p.id = cr.creada_por
            ORDER BY cr.nombre ASC
          ) c
        ), '[]'::jsonb)
      )
    );

  -- ── PROFESOR ───────────────────────────────────────────────────────────────
  ELSIF v_rol = 'profesor' THEN
    RETURN (
      SELECT jsonb_build_object(
        'recursos', COALESCE((
          SELECT jsonb_agg(to_jsonb(r))
          FROM (
            SELECT rc.*, p.nombre || ' ' || p.apellido AS uploader_nombre,
              (SELECT COUNT(*) FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
            FROM public.recursos_compartidos rc
            JOIN public.profiles p ON p.id = rc.subido_por
            WHERE rc.subido_por = v_user_id
            ORDER BY
              CASE p_sort_by WHEN 'created_at_asc'  THEN rc.created_at END ASC,
              CASE p_sort_by WHEN 'created_at_desc' THEN rc.created_at END DESC,
              CASE p_sort_by WHEN 'nombre_asc'  THEN rc.titulo
                             WHEN 'tipo_asc'    THEN rc.tipo  END ASC,
              CASE p_sort_by WHEN 'nombre_desc' THEN rc.titulo END DESC,
              rc.created_at DESC
          ) r
        ), '[]'::jsonb),
        'carpetas', COALESCE((
          SELECT jsonb_agg(to_jsonb(c))
          FROM (
            SELECT cr.*,
              p.nombre || ' ' || p.apellido AS creador_nombre,
              public.count_recursos_in_folder(cr.id) AS recursive_recursos_count,
              EXISTS (
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT 1 FROM public.recursos_compartidos rc2
                WHERE rc2.carpeta_id IN (SELECT id FROM ft) AND rc2.para_todos = true AND rc2.subido_por = v_user_id
              ) AS para_todos_efectivo,
              EXISTS (
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT 1 FROM public.recursos_compartidos rc2
                WHERE rc2.carpeta_id IN (SELECT id FROM ft) AND rc2.para_todos_app = true AND rc2.subido_por = v_user_id
              ) AS para_todos_app_efectivo,
              COALESCE((
                WITH RECURSIVE ft AS (
                  SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                  UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
                )
                SELECT jsonb_agg(DISTINCT ra2.alumno_id)
                FROM public.recursos_acceso ra2
                JOIN public.recursos_compartidos rc3 ON rc3.id = ra2.recurso_id
                WHERE rc3.carpeta_id IN (SELECT id FROM ft) AND rc3.subido_por = v_user_id
              ), '[]'::jsonb) AS alumno_ids_efectivos
            FROM public.carpetas_recursos cr
            JOIN public.profiles p ON p.id = cr.creada_por
            WHERE cr.creada_por = v_user_id
            ORDER BY cr.nombre ASC
          ) c
        ), '[]'::jsonb)
      )
    );

  -- ── ALUMNO ─────────────────────────────────────────────────────────────────
  ELSIF v_rol = 'alumno' THEN
    RETURN (
      SELECT jsonb_build_object(
        'recursos', COALESCE((
          SELECT jsonb_agg(to_jsonb(r))
          FROM (
            SELECT rc.id, rc.titulo, rc.descripcion, rc.tipo, rc.url,
              rc.storage_path, rc.para_todos, rc.para_todos_app, rc.bloquear_descarga,
              rc.created_at, rc.carpeta_id,
              p.nombre || ' ' || p.apellido AS uploader_nombre
            FROM public.recursos_compartidos rc
            JOIN public.profiles p ON p.id = rc.subido_por
            WHERE
              EXISTS (SELECT 1 FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id)
              OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
              OR (rc.para_todos = true AND EXISTS (
                SELECT 1 FROM public.alumnos_extra ae WHERE ae.alumno_id = v_user_id AND ae.profesor_id = rc.subido_por
              ))
              OR rc.para_todos_app = true
            ORDER BY
              CASE p_sort_by WHEN 'created_at_asc'  THEN rc.created_at END ASC,
              CASE p_sort_by WHEN 'created_at_desc' THEN rc.created_at END DESC,
              CASE p_sort_by WHEN 'nombre_asc'  THEN rc.titulo
                             WHEN 'tipo_asc'    THEN rc.tipo  END ASC,
              CASE p_sort_by WHEN 'nombre_desc' THEN rc.titulo END DESC,
              rc.created_at DESC
          ) r
        ), '[]'::jsonb),
        'carpetas', COALESCE((
          SELECT jsonb_agg(to_jsonb(c))
          FROM (
            SELECT DISTINCT cr.id, cr.nombre, cr.parent_id, cr.creada_por, cr.created_at, cr.updated_at,
              p.nombre || ' ' || p.apellido AS creador_nombre,
              public.count_recursos_in_folder(cr.id) AS recursive_recursos_count,
              false AS para_todos_efectivo,
              false AS para_todos_app_efectivo,
              '[]'::jsonb AS alumno_ids_efectivos
            FROM public.carpetas_recursos cr
            JOIN public.profiles p ON p.id = cr.creada_por
            WHERE EXISTS (
              WITH RECURSIVE ft AS (
                SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
              )
              SELECT 1 FROM public.recursos_compartidos rc
              WHERE rc.carpeta_id IN (SELECT id FROM ft)
                AND (
                  EXISTS (SELECT 1 FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id)
                  OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
                  OR (rc.para_todos = true AND EXISTS (
                    SELECT 1 FROM public.alumnos_extra ae WHERE ae.alumno_id = v_user_id AND ae.profesor_id = rc.subido_por
                  ))
                  OR rc.para_todos_app = true
                )
            )
            ORDER BY cr.nombre ASC
          ) c
        ), '[]'::jsonb)
      )
    );

  -- ── LECTOR ─────────────────────────────────────────────────────────────────
  ELSIF v_rol = 'lector' THEN
    RETURN (
      SELECT jsonb_build_object(
        'recursos', COALESCE((
          SELECT jsonb_agg(to_jsonb(r))
          FROM (
            SELECT rc.id, rc.titulo, rc.descripcion, rc.tipo, rc.url,
              rc.storage_path, rc.para_todos, rc.para_todos_app, rc.bloquear_descarga,
              rc.created_at, rc.carpeta_id,
              p.nombre || ' ' || p.apellido AS uploader_nombre
            FROM public.recursos_compartidos rc
            JOIN public.profiles p ON p.id = rc.subido_por
            WHERE
              EXISTS (SELECT 1 FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id)
              OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
              OR rc.para_todos_app = true
            ORDER BY
              CASE p_sort_by WHEN 'created_at_asc'  THEN rc.created_at END ASC,
              CASE p_sort_by WHEN 'created_at_desc' THEN rc.created_at END DESC,
              CASE p_sort_by WHEN 'nombre_asc'  THEN rc.titulo
                             WHEN 'tipo_asc'    THEN rc.tipo  END ASC,
              CASE p_sort_by WHEN 'nombre_desc' THEN rc.titulo END DESC,
              rc.created_at DESC
          ) r
        ), '[]'::jsonb),
        'carpetas', COALESCE((
          SELECT jsonb_agg(to_jsonb(c))
          FROM (
            SELECT DISTINCT cr.id, cr.nombre, cr.parent_id, cr.creada_por, cr.created_at, cr.updated_at,
              p.nombre || ' ' || p.apellido AS creador_nombre,
              public.count_recursos_in_folder(cr.id) AS recursive_recursos_count,
              false AS para_todos_efectivo,
              false AS para_todos_app_efectivo,
              '[]'::jsonb AS alumno_ids_efectivos
            FROM public.carpetas_recursos cr
            JOIN public.profiles p ON p.id = cr.creada_por
            WHERE EXISTS (
              WITH RECURSIVE ft AS (
                SELECT id FROM public.carpetas_recursos WHERE id = cr.id
                UNION ALL SELECT c2.id FROM public.carpetas_recursos c2 INNER JOIN ft ON c2.parent_id = ft.id
              )
              SELECT 1 FROM public.recursos_compartidos rc
              WHERE rc.carpeta_id IN (SELECT id FROM ft)
                AND (
                  EXISTS (SELECT 1 FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id)
                  OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
                  OR rc.para_todos_app = true
                )
            )
            ORDER BY cr.nombre ASC
          ) c
        ), '[]'::jsonb)
      )
    );
  END IF;

  RETURN jsonb_build_object('recursos', '[]'::jsonb, 'carpetas', '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recursos_for_user(TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. get_admin_prefetch — + lectores + enlaces + sort pre-aplicado
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_admin_prefetch(p_admin_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_id   UUID := COALESCE(p_admin_id, auth.uid());
  v_today      DATE := current_date;
  v_week_start DATE := date_trunc('week', current_date)::date;
  v_week_end   DATE := date_trunc('week', current_date)::date + 6;
  v_month_start DATE := date_trunc('month', current_date)::date;
  v_month_end   DATE := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  v_year  INT := EXTRACT(YEAR  FROM current_date)::int;
  v_month INT := EXTRACT(MONTH FROM current_date)::int;

  v_sort_by TEXT := 'created_at_desc';

  v_stats       JSONB; v_alumnos     JSONB; v_profesores  JSONB; v_lectores    JSONB;
  v_notif_dash  JSONB; v_notif_full  JSONB;
  v_clases_hoy  JSONB; v_horarios_cal JSONB; v_bloqueos   JSONB;
  v_programas   JSONB; v_pagos_mes   JSONB; v_pagos_anual JSONB;
  v_recursos    JSONB; v_enlaces     JSONB;
BEGIN
  -- Lee la preferencia de orden de recursos del admin (default 'created_at_desc')
  SELECT COALESCE(urp.sort_by, 'created_at_desc')
    INTO v_sort_by
    FROM public.user_recursos_preferences urp
   WHERE urp.user_id = v_admin_id;

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
      CASE WHEN NOT p.activo THEN 'bloqueado' WHEN COALESCE(ae.paso_prueba,false) THEN 'graduado'
           WHEN pu.user_id IS NOT NULL THEN 'pendiente' ELSE 'activo' END AS estado
    FROM profiles p LEFT JOIN alumnos_extra ae ON ae.alumno_id=p.id
    LEFT JOIN profiles prof ON prof.id=ae.profesor_id LEFT JOIN pu ON pu.user_id=p.id
    WHERE p.rol='alumno'
  ) s;

  -- 3. Profesores
  WITH pu AS (SELECT DISTINCT user_id FROM invitations WHERE used=false AND expires_at>now()),
  ac AS (SELECT profesor_id,COUNT(*) AS total FROM alumnos_extra WHERE profesor_id IS NOT NULL GROUP BY profesor_id)
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.nombre),'[]'::jsonb) INTO v_profesores FROM (
    SELECT p.id,p.nombre,p.apellido,p.apellido_materno,p.email,p.telefono,p.avatar_url,p.activo,
      p.rol::TEXT AS rol,p.puede_crear_alumno,COALESCE(ac.total,0) AS alumnos_count,
      CASE WHEN pu.user_id IS NOT NULL THEN 'Pendiente' ELSE 'Activo' END AS estado_cuenta
    FROM profiles p LEFT JOIN pu ON pu.user_id=p.id LEFT JOIN ac ON ac.profesor_id=p.id
    WHERE p.rol IN ('profesor','admin')
  ) s;

  -- 4. Lectores
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.nombre),'[]'::jsonb) INTO v_lectores FROM (
    SELECT p.id,p.nombre,p.apellido,p.apellido_materno,p.email,p.telefono,p.avatar_url,p.activo
    FROM profiles p WHERE p.rol='lector'
  ) s;

  -- 5. Notificaciones dashboard (top 10, excluyendo descartadas)
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
    WHERE NOT EXISTS(SELECT 1 FROM notificaciones_descartadas_admin nda WHERE nda.notificacion_id=n.id AND nda.admin_id=v_admin_id)
    ORDER BY n.created_at DESC LIMIT 10
  ) s;

  -- 6. Notificaciones full view (hasta 500, excluyendo descartadas)
  SELECT jsonb_build_object(
    'data', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY (s.created_at) DESC) FROM (
      SELECT n.id,n.destinatario_id,n.tipo,n.mensaje,n.horario_id,n.alumno_id,n.programa_id,n.solicitud_id,n.created_at,
        CASE WHEN h.id IS NOT NULL THEN jsonb_build_object('id',h.id,'fecha',h.fecha,'hora_inicio',h.hora_inicio,'hora_fin',h.hora_fin) ELSE NULL END AS horario,
        CASE WHEN al.id IS NOT NULL THEN jsonb_build_object('id',al.id,'nombre',al.nombre,'apellido',al.apellido) ELSE NULL END AS alumno,
        CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('id',d.id,'nombre',d.nombre,'apellido',d.apellido,'rol',d.rol) ELSE NULL END AS destinatario,
        CASE WHEN so.id IS NOT NULL THEN jsonb_build_object('id',so.id,'alumno_id',so.alumno_id,'profesor_id',so.profesor_id,'horario_original_id',so.horario_original_id,'fecha_propuesta',so.fecha_propuesta,'hora_inicio_propuesta',so.hora_inicio_propuesta,'hora_fin_propuesta',so.hora_fin_propuesta,'estado',so.estado,'motivo_rechazo',so.motivo_rechazo,'nuevo_horario_id',so.nuevo_horario_id,'nota_alumno',so.nota_alumno,'created_at',so.created_at,'updated_at',so.updated_at) ELSE NULL END AS solicitud,
        (EXISTS(SELECT 1 FROM notificaciones_vistas_admin nva WHERE nva.notificacion_id=n.id AND nva.admin_id=v_admin_id)) AS leida
      FROM notificaciones n
      LEFT JOIN horarios h ON h.id=n.horario_id LEFT JOIN profiles al ON al.id=n.alumno_id
      LEFT JOIN profiles d ON d.id=n.destinatario_id LEFT JOIN solicitudes_cambio_horario so ON so.id=n.solicitud_id
      WHERE NOT EXISTS(SELECT 1 FROM notificaciones_descartadas_admin nda WHERE nda.notificacion_id=n.id AND nda.admin_id=v_admin_id)
      ORDER BY n.created_at DESC LIMIT 500
    ) s),'[]'::jsonb),
    'total',(SELECT count(*) FROM notificaciones WHERE NOT EXISTS(SELECT 1 FROM notificaciones_descartadas_admin nda WHERE nda.notificacion_id=notificaciones.id AND nda.admin_id=v_admin_id)),
    'page',1,'page_size',500,'total_pages',1
  ) INTO v_notif_full;

  -- 7. Clases hoy
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.hora_inicio),'[]'::jsonb) INTO v_clases_hoy FROM (
    SELECT h.id,h.titulo,h.fecha,h.hora_inicio,h.hora_fin,h.activo,
      jsonb_build_object('nombre',al.nombre,'apellido',al.apellido) AS alumno,
      jsonb_build_object('nombre',pr.nombre,'apellido',pr.apellido) AS profesor,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('estado',a.estado)),'[]'::jsonb) FROM asistencia a WHERE a.horario_id=h.id) AS asistencia
    FROM horarios h LEFT JOIN profiles al ON al.id=h.alumno_id LEFT JOIN profiles pr ON pr.id=h.profesor_id
    WHERE h.fecha=v_today AND h.activo=true
  ) s;

  -- 8. Todos los horarios activos para CalendarioAdmin
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.fecha ASC),'[]'::jsonb) INTO v_horarios_cal FROM (
    SELECT h.*,
      (SELECT COALESCE(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM asistencia a WHERE a.horario_id=h.id) AS asistencia,
      (SELECT to_jsonb(al) FROM (SELECT p.id,p.nombre,p.apellido,p.email,p.avatar_url,p.telefono,p.activo,p.rol FROM profiles p WHERE p.id=h.alumno_id) al) AS alumno,
      (SELECT jsonb_build_object('id',pr.id,'nombre',pr.nombre,'apellido',pr.apellido,'avatar_url',pr.avatar_url) FROM profiles pr WHERE pr.id=h.profesor_id) AS profesor,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',pu.id,'nota',pu.nota)),'[]'::jsonb) FROM pruebas pu WHERE pu.horario_id=h.id) AS pruebas
    FROM horarios h WHERE h.activo=true
  ) s;

  -- 9. Bloqueos activos
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.fecha ASC,s.hora_inicio ASC),'[]'::jsonb) INTO v_bloqueos FROM (
    SELECT bh.*,
      jsonb_build_object('id',pr.id,'nombre',pr.nombre,'apellido',pr.apellido,'avatar_url',pr.avatar_url) AS profesor
    FROM bloqueos_horario bh LEFT JOIN profiles pr ON pr.id=bh.profesor_id WHERE bh.activo=true
  ) s;

  -- 10. Programas (todos)
  SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]'::jsonb) INTO v_programas FROM (
    SELECT pc.id,pc.nombre,pc.descripcion,pc.estado,pc.visibilidad,pc.profesor_id,pc.created_by,pc.created_at,pc.updated_at,
      CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('id',pr.id,'nombre',pr.nombre,'apellido',pr.apellido,'avatar_url',pr.avatar_url) ELSE NULL END AS profesor,
      CASE WHEN cb.id IS NOT NULL THEN jsonb_build_object('id',cb.id,'nombre',cb.nombre,'apellido',cb.apellido) ELSE NULL END AS creado_por,
      (SELECT count(*) FROM clases_programa cp WHERE cp.programa_id=pc.id)::int AS total_clases,
      (SELECT count(*) FROM asignaciones_programa ap WHERE ap.programa_id=pc.id AND ap.estado='activo')::int AS total_asignados,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',pp_pr.id,'nombre',pp_pr.nombre,'apellido',pp_pr.apellido,'avatar_url',pp_pr.avatar_url)),'[]'::jsonb) FROM programa_profesores pp JOIN profiles pp_pr ON pp_pr.id=pp.profesor_id WHERE pp.programa_id=pc.id) AS profesores_asignados
    FROM programas_clases pc LEFT JOIN profiles pr ON pr.id=pc.profesor_id LEFT JOIN profiles cb ON cb.id=pc.created_by
    ORDER BY pc.created_at DESC
  ) s;

  -- 11. Pagos mes actual
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.nombre),'[]'::jsonb) INTO v_pagos_mes FROM (
    SELECT p.id AS alumno_id,p.nombre,p.apellido,p.avatar_url,p.activo,COALESCE(ae.paso_prueba,false) AS paso_prueba,
      ae.profesor_id,prof.nombre AS profesor_nombre,prof.apellido AS profesor_apellido,
      pg.id AS pago_id,pg.estado AS pago_estado,pg.monto_pagado AS pago_monto,pg.fecha_pago AS pago_fecha
    FROM profiles p LEFT JOIN alumnos_extra ae ON ae.alumno_id=p.id
    LEFT JOIN profiles prof ON prof.id=ae.profesor_id
    LEFT JOIN pagos pg ON pg.alumno_id=p.id AND pg.anio=v_year AND pg.mes=v_month
    WHERE p.rol='alumno' AND p.activo=true
  ) s;

  -- 12. Pagos resumen anual
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.nombre),'[]'::jsonb) INTO v_pagos_anual FROM (
    SELECT p.id AS alumno_id,p.nombre,p.apellido,p.activo,COALESCE(ae.paso_prueba,false) AS paso_prueba,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('mes',m.n,'estado',pg2.estado,'monto_pagado',pg2.monto_pagado) ORDER BY m.n),'[]'::jsonb)
       FROM generate_series(1,12) AS m(n)
       LEFT JOIN pagos pg2 ON pg2.alumno_id=p.id AND pg2.anio=v_year AND pg2.mes=m.n) AS pagos
    FROM profiles p LEFT JOIN alumnos_extra ae ON ae.alumno_id=p.id
    WHERE p.rol='alumno' AND p.activo=true
  ) s;

  -- 13. Recursos (con sort pre-aplicado)
  v_recursos := get_recursos_for_user(v_sort_by);

  -- 14. Enlaces de invitación (sin eliminados)
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC),'[]'::jsonb) INTO v_enlaces FROM (
    SELECT
      ei.id, ei.codigo, ei.tipo, ei.estado, ei.created_by, ei.created_at, ei.updated_at,
      ei.profesor_asignado, ei.usuario_creado,
      CASE WHEN cr.id IS NOT NULL THEN jsonb_build_object('id',cr.id,'nombre',cr.nombre,'apellido',cr.apellido) ELSE NULL END AS creador,
      CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('id',pr.id,'nombre',pr.nombre,'apellido',pr.apellido) ELSE NULL END AS profesor,
      CASE WHEN us.id IS NOT NULL THEN jsonb_build_object(
        'id',us.id,'nombre',us.nombre,'apellido',us.apellido,
        'apellido_materno',us.apellido_materno,'email',us.email,'activo',us.activo
      ) ELSE NULL END AS usuario
    FROM public.enlaces_invitacion ei
    LEFT JOIN public.profiles cr ON cr.id = ei.created_by
    LEFT JOIN public.profiles pr ON pr.id = ei.profesor_asignado
    LEFT JOIN public.profiles us ON us.id = ei.usuario_creado
    WHERE ei.eliminado = false
  ) s;

  RETURN jsonb_build_object(
    'stats',               v_stats,
    'alumnos',             v_alumnos,
    'profesores',          v_profesores,
    'lectores',            v_lectores,
    'notificaciones',      v_notif_dash,
    'notificaciones_full', v_notif_full,
    'clases_hoy',          v_clases_hoy,
    'horarios_calendario', v_horarios_cal,
    'bloqueos',            v_bloqueos,
    'programas',           v_programas,
    'pagos_mes',           v_pagos_mes,
    'pagos_anual',         v_pagos_anual,
    'recursos',            v_recursos,
    'enlaces',             v_enlaces
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_prefetch(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. get_profesor_prefetch — sort pre-aplicado
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_profesor_prefetch(p_profesor_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_week_start DATE := date_trunc('week', current_date)::date;
  v_week_end   DATE := date_trunc('week', current_date)::date + 6;
  v_sort_by    TEXT := 'created_at_desc';
  v_horarios JSONB; v_stats JSONB; v_alumnos_cal JSONB;
  v_mis_alumnos JSONB; v_todos_alumnos JSONB;
  v_programas JSONB; v_notif_full JSONB; v_bloqueos JSONB; v_recursos JSONB;
BEGIN
  SELECT COALESCE(urp.sort_by, 'created_at_desc') INTO v_sort_by
    FROM public.user_recursos_preferences urp WHERE urp.user_id = p_profesor_id;

  -- 1a. Horarios del profesor
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.fecha ASC,t.hora_inicio ASC),'[]'::jsonb) INTO v_horarios FROM (
    SELECT h.*,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',a.id,'estado',a.estado,'nota_alumno',a.nota_alumno)),'[]'::jsonb) FROM asistencia a WHERE a.horario_id=h.id) AS asistencia,
      (SELECT jsonb_build_object('id',p.id,'nombre',p.nombre,'apellido',p.apellido,'email',p.email,'avatar_url',p.avatar_url) FROM profiles p WHERE p.id=h.alumno_id) AS alumno
    FROM horarios h WHERE h.profesor_id=p_profesor_id AND h.activo=true
  ) t;

  -- 1b. Stats semanales
  SELECT jsonb_build_object('total',count(*),'pendientes',count(*) FILTER(WHERE sub.estado='pendiente'),'confirmadas',count(*) FILTER(WHERE sub.estado='confirmado'),'canceladas',count(*) FILTER(WHERE sub.estado='cancelado'))
  INTO v_stats FROM (
    SELECT COALESCE((SELECT a.estado FROM asistencia a WHERE a.horario_id=h.id LIMIT 1),'pendiente') AS estado
    FROM horarios h WHERE h.profesor_id=p_profesor_id AND h.activo=true AND h.fecha BETWEEN v_week_start AND v_week_end
  ) sub;

  -- 1c. Alumnos del profesor (shape simple para el calendario)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'apellido',p.apellido,'email',p.email,'avatar_url',p.avatar_url) ORDER BY p.nombre),'[]'::jsonb)
  INTO v_alumnos_cal FROM profiles p INNER JOIN alumnos_extra ae ON ae.alumno_id=p.id WHERE ae.profesor_id=p_profesor_id AND p.activo=true;

  -- 2. Mis alumnos
  WITH pu AS (SELECT DISTINCT user_id FROM invitations WHERE used=false AND expires_at>now())
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.nombre),'[]'::jsonb) INTO v_mis_alumnos FROM (
    SELECT p.id,p.nombre,p.apellido,p.apellido_materno,p.email,p.telefono,p.avatar_url,p.activo,p.rol::TEXT AS rol,
      ae.alumno_id,ae.profesor_id,ae.universidad,ae.año_ingreso,ae.año_egreso,ae.notas,
      COALESCE(ae.paso_prueba,false) AS paso_prueba,ae.fecha_prueba,COALESCE(ae.ha_dado_examen,false) AS ha_dado_examen,ae.intentos_prueba,
      CASE WHEN pu.user_id IS NOT NULL THEN 'Pendiente' ELSE 'Activo' END AS estado_cuenta
    FROM profiles p INNER JOIN alumnos_extra ae ON ae.alumno_id=p.id LEFT JOIN pu ON pu.user_id=p.id
    WHERE p.rol='alumno' AND p.activo=true AND ae.profesor_id=p_profesor_id
  ) s;

  -- 3. Todos los alumnos
  WITH pu AS (SELECT DISTINCT user_id FROM invitations WHERE used=false AND expires_at>now())
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.nombre),'[]'::jsonb) INTO v_todos_alumnos FROM (
    SELECT p.id,p.nombre,p.apellido,p.apellido_materno,p.email,p.telefono,p.avatar_url,p.activo,p.rol::TEXT AS rol,
      ae.alumno_id,ae.profesor_id,ae.universidad,ae.año_ingreso,ae.año_egreso,ae.notas,
      COALESCE(ae.paso_prueba,false) AS paso_prueba,ae.fecha_prueba,COALESCE(ae.ha_dado_examen,false) AS ha_dado_examen,ae.intentos_prueba,
      CASE WHEN pu.user_id IS NOT NULL THEN 'Pendiente' ELSE 'Activo' END AS estado_cuenta
    FROM profiles p INNER JOIN alumnos_extra ae ON ae.alumno_id=p.id LEFT JOIN pu ON pu.user_id=p.id
    WHERE p.rol='alumno' AND p.activo=true
  ) s;

  -- 4. Programas activos visibles para el profesor
  SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]'::jsonb) INTO v_programas FROM (
    SELECT pc.id,pc.nombre,pc.descripcion,pc.estado,pc.visibilidad,pc.profesor_id,pc.created_by,pc.created_at,pc.updated_at,
      CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('id',pr.id,'nombre',pr.nombre,'apellido',pr.apellido,'avatar_url',pr.avatar_url) ELSE NULL END AS profesor,
      CASE WHEN cb.id IS NOT NULL THEN jsonb_build_object('id',cb.id,'nombre',cb.nombre,'apellido',cb.apellido) ELSE NULL END AS creado_por,
      (SELECT count(*) FROM clases_programa cp WHERE cp.programa_id=pc.id)::int AS total_clases,
      (SELECT count(*) FROM asignaciones_programa ap WHERE ap.programa_id=pc.id AND ap.estado='activo')::int AS total_asignados,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',pp_pr.id,'nombre',pp_pr.nombre,'apellido',pp_pr.apellido,'avatar_url',pp_pr.avatar_url)),'[]'::jsonb) FROM programa_profesores pp JOIN profiles pp_pr ON pp_pr.id=pp.profesor_id WHERE pp.programa_id=pc.id) AS profesores_asignados
    FROM programas_clases pc LEFT JOIN profiles pr ON pr.id=pc.profesor_id LEFT JOIN profiles cb ON cb.id=pc.created_by
    WHERE pc.estado='activo' AND (pc.profesor_id=p_profesor_id OR pc.visibilidad='todos' OR EXISTS(SELECT 1 FROM programa_profesores pp WHERE pp.programa_id=pc.id AND pp.profesor_id=p_profesor_id))
    ORDER BY pc.created_at DESC
  ) s;

  -- 5. Notificaciones full (propias del profesor)
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
      WHERE n.destinatario_id=p_profesor_id ORDER BY n.created_at DESC LIMIT 500
    ) s),'[]'::jsonb),
    'total',(SELECT count(*) FROM notificaciones WHERE destinatario_id=p_profesor_id),
    'page',1,'page_size',500,'total_pages',1
  ) INTO v_notif_full;

  -- 6. Recursos (con sort pre-aplicado)
  v_recursos := get_recursos_for_user(v_sort_by);

  -- 7. Bloqueos propios del profesor
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.fecha ASC,s.hora_inicio ASC),'[]'::jsonb) INTO v_bloqueos FROM (
    SELECT b.*,jsonb_build_object('id',pr.id,'nombre',pr.nombre,'apellido',pr.apellido,'apellido_materno',pr.apellido_materno,'rol',pr.rol::TEXT,'avatar_url',pr.avatar_url) AS profesor
    FROM bloqueos_horario b LEFT JOIN profiles pr ON pr.id=b.profesor_id WHERE b.activo=true AND b.profesor_id=p_profesor_id
  ) s;

  RETURN jsonb_build_object(
    'horarios',           jsonb_build_object('horarios',v_horarios,'stats',v_stats,'alumnos',v_alumnos_cal),
    'mis_alumnos',        v_mis_alumnos,
    'todos_alumnos',      v_todos_alumnos,
    'programas',          v_programas,
    'notificaciones_full',v_notif_full,
    'bloqueos',           v_bloqueos,
    'recursos',           v_recursos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profesor_prefetch(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. get_alumno_prefetch — sort pre-aplicado
-- ═══════════════════════════════════════════════════════════════════════════
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
            'profesor',(SELECT jsonb_build_object('id',p.id,'nombre',p.nombre,'apellido',p.apellido,'avatar_url',p.avatar_url) FROM profiles p WHERE p.id=h.profesor_id)
          )
        ) ORDER BY h.fecha DESC,h.hora_inicio DESC
      ),'[]'::jsonb)
      FROM asistencia a INNER JOIN horarios h ON h.id=a.horario_id WHERE a.alumno_id=p_alumno_id
    ),
    'proxima_clase',(
      SELECT to_jsonb(t) FROM (
        SELECT a.id,a.estado,a.nota_alumno,
          jsonb_build_object('id',h.id,'titulo',h.titulo,'fecha',h.fecha,'hora_inicio',h.hora_inicio,'hora_fin',h.hora_fin,'descripcion',h.descripcion,
            'profesor',(SELECT jsonb_build_object('id',p.id,'nombre',p.nombre,'apellido',p.apellido) FROM profiles p WHERE p.id=h.profesor_id)
          ) AS horario
        FROM asistencia a INNER JOIN horarios h ON h.id=a.horario_id
        WHERE a.alumno_id=p_alumno_id AND h.activo=true AND h.fecha>=current_date
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. get_lector_prefetch — sort pre-aplicado
-- ═══════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_lector_prefetch(uuid);

CREATE OR REPLACE FUNCTION public.get_lector_prefetch(p_lector_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sort_by TEXT := 'created_at_desc';
  v_recursos JSONB;
BEGIN
  SELECT COALESCE(urp.sort_by, 'created_at_desc') INTO v_sort_by
    FROM public.user_recursos_preferences urp WHERE urp.user_id = p_lector_id;

  v_recursos := get_recursos_for_user(v_sort_by);

  RETURN jsonb_build_object('recursos', v_recursos);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lector_prefetch(UUID) TO authenticated;
