-- ── 090: Add last_sign_in_at to get_alumnos_admin and get_alumnos_profesor RPCs ──
-- Reads last_sign_in_at from auth.users so admins/profesores can see
-- the last time each student or reader logged into the platform.

-- ── 1. Drop existing functions (return type changed) ────────────────────────────
DROP FUNCTION IF EXISTS public.get_alumnos_admin(text, uuid, text);
DROP FUNCTION IF EXISTS public.get_alumnos_profesor(uuid, text);

-- ── 2. Recreate get_alumnos_admin with last_sign_in_at ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_alumnos_admin(
  p_q text DEFAULT NULL,
  p_profesor_id uuid DEFAULT NULL,
  p_estado text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  nombre text,
  apellido text,
  apellido_materno text,
  email text,
  telefono text,
  avatar_url text,
  activo boolean,
  profesor_id uuid,
  profesor_nombre text,
  profesor_apellido text,
  universidad text,
  "año_ingreso" text,
  "año_egreso" text,
  fecha_ingreso date,
  notas text,
  paso_prueba boolean,
  fecha_prueba date,
  estado text,
  last_sign_in_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  WITH pending_users AS (
    SELECT DISTINCT user_id
    FROM invitations
    WHERE used = false AND expires_at > now()
  )
  SELECT
    p.id, p.nombre, p.apellido, p.apellido_materno,
    p.email, p.telefono, p.avatar_url, p.activo,
    ae.profesor_id,
    prof.nombre  AS profesor_nombre,
    prof.apellido AS profesor_apellido,
    ae.universidad,
    ae.año_ingreso,
    ae.año_egreso,
    ae.fecha_ingreso,
    ae.notas,
    COALESCE(ae.paso_prueba, false) AS paso_prueba,
    ae.fecha_prueba,
    CASE
      WHEN NOT p.activo                          THEN 'bloqueado'
      WHEN COALESCE(ae.paso_prueba, false)       THEN 'graduado'
      WHEN pu.user_id IS NOT NULL                THEN 'pendiente'
      ELSE 'activo'
    END AS estado,
    au.last_sign_in_at
  FROM profiles p
  LEFT JOIN alumnos_extra    ae   ON ae.alumno_id = p.id
  LEFT JOIN profiles         prof ON prof.id = ae.profesor_id
  LEFT JOIN pending_users    pu   ON pu.user_id = p.id
  LEFT JOIN auth.users       au   ON au.id = p.id
  WHERE
    p.rol = 'alumno'
    AND (p_q IS NULL OR (
          p.nombre  ILIKE '%' || p_q || '%'
       OR p.apellido ILIKE '%' || p_q || '%'
       OR p.email    ILIKE '%' || p_q || '%'
    ))
    AND (p_profesor_id IS NULL OR ae.profesor_id = p_profesor_id)
    AND (
      p_estado IS NULL
      OR (p_estado = 'bloqueado'  AND NOT p.activo)
      OR (p_estado = 'graduado'   AND COALESCE(ae.paso_prueba, false))
      OR (p_estado = 'pendiente'  AND p.activo AND NOT COALESCE(ae.paso_prueba, false) AND pu.user_id IS NOT NULL)
      OR (p_estado = 'activo'     AND p.activo AND NOT COALESCE(ae.paso_prueba, false) AND pu.user_id IS NULL)
    )
  ORDER BY p.nombre;
$function$;

-- ── 3. Recreate get_alumnos_profesor with last_sign_in_at ───────────────────────
CREATE OR REPLACE FUNCTION public.get_alumnos_profesor(
  p_profesor_id uuid,
  p_scope text DEFAULT 'mis'
)
RETURNS TABLE(
  id uuid,
  nombre text,
  apellido text,
  apellido_materno text,
  email text,
  telefono text,
  avatar_url text,
  activo boolean,
  rol text,
  alumno_id uuid,
  profesor_id uuid,
  universidad text,
  "año_ingreso" text,
  "año_egreso" text,
  notas text,
  paso_prueba boolean,
  fecha_prueba date,
  ha_dado_examen boolean,
  intentos_prueba integer,
  estado_cuenta text,
  last_sign_in_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  WITH pending_users AS (
    SELECT DISTINCT user_id
    FROM invitations
    WHERE used = false AND expires_at > now()
  )
  SELECT
    p.id, p.nombre, p.apellido, p.apellido_materno,
    p.email, p.telefono, p.avatar_url, p.activo,
    p.rol::TEXT,
    ae.alumno_id, ae.profesor_id, ae.universidad,
    ae.año_ingreso, ae.año_egreso, ae.notas,
    COALESCE(ae.paso_prueba, false)    AS paso_prueba,
    ae.fecha_prueba,
    COALESCE(ae.ha_dado_examen, false) AS ha_dado_examen,
    ae.intentos_prueba,
    CASE
      WHEN pu.user_id IS NOT NULL THEN 'Pendiente'
      ELSE 'Activo'
    END AS estado_cuenta,
    au.last_sign_in_at
  FROM profiles p
  INNER JOIN alumnos_extra ae ON ae.alumno_id = p.id
  LEFT JOIN  pending_users pu ON pu.user_id  = p.id
  LEFT JOIN  auth.users    au ON au.id = p.id
  WHERE
    p.rol    = 'alumno'
    AND p.activo = true
    AND (p_scope = 'todos' OR ae.profesor_id = p_profesor_id)
  ORDER BY p.nombre;
$function$;
