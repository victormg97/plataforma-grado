-- Migration 038: Add fecha_ingreso to alumnos_extra and create alumno_bloqueos table

-- 1. fecha_ingreso en alumnos_extra
ALTER TABLE public.alumnos_extra
  ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;

-- Backfill: asignar created_at::date a los alumnos existentes que no tengan fecha
UPDATE public.alumnos_extra
SET fecha_ingreso = created_at::date
WHERE fecha_ingreso IS NULL;

-- 2. Tabla de registro de bloqueos
CREATE TABLE IF NOT EXISTS public.alumno_bloqueos (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  alumno_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bloqueado_por UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  accion        TEXT        NOT NULL CHECK (accion IN ('bloqueado', 'desbloqueado')),
  motivo        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alumno_bloqueos_alumno_id_idx  ON public.alumno_bloqueos(alumno_id);
CREATE INDEX IF NOT EXISTS alumno_bloqueos_created_at_idx ON public.alumno_bloqueos(created_at DESC);

ALTER TABLE public.alumno_bloqueos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'alumno_bloqueos' AND policyname = 'Admin gestiona bloqueos'
  ) THEN
    CREATE POLICY "Admin gestiona bloqueos"
      ON public.alumno_bloqueos FOR ALL
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'alumno_bloqueos' AND policyname = 'Profesor ve bloqueos de sus alumnos'
  ) THEN
    CREATE POLICY "Profesor ve bloqueos de sus alumnos"
      ON public.alumno_bloqueos FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.alumnos_extra ae
          WHERE ae.alumno_id = alumno_bloqueos.alumno_id
            AND ae.profesor_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 3. Actualizar función get_alumnos_admin para incluir fecha_ingreso
DROP FUNCTION IF EXISTS get_alumnos_admin(text, uuid, text);

CREATE FUNCTION get_alumnos_admin(
  p_q TEXT DEFAULT NULL,
  p_profesor_id UUID DEFAULT NULL,
  p_estado TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  apellido TEXT,
  apellido_materno TEXT,
  email TEXT,
  telefono TEXT,
  avatar_url TEXT,
  activo BOOLEAN,
  profesor_id UUID,
  profesor_nombre TEXT,
  profesor_apellido TEXT,
  universidad TEXT,
  año_ingreso TEXT,
  fecha_ingreso DATE,
  notas TEXT,
  paso_prueba BOOLEAN,
  fecha_prueba DATE,
  estado TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH pending_users AS (
    SELECT DISTINCT user_id
    FROM invitations
    WHERE used = false AND expires_at > now()
  )
  SELECT
    p.id,
    p.nombre,
    p.apellido,
    p.apellido_materno,
    p.email,
    p.telefono,
    p.avatar_url,
    p.activo,
    ae.profesor_id,
    prof.nombre  AS profesor_nombre,
    prof.apellido AS profesor_apellido,
    ae.universidad,
    ae.año_ingreso,
    ae.fecha_ingreso,
    ae.notas,
    COALESCE(ae.paso_prueba, false) AS paso_prueba,
    ae.fecha_prueba,
    CASE
      WHEN NOT p.activo                          THEN 'bloqueado'
      WHEN COALESCE(ae.paso_prueba, false)       THEN 'graduado'
      WHEN pu.user_id IS NOT NULL                THEN 'pendiente'
      ELSE 'activo'
    END AS estado
  FROM profiles p
  LEFT JOIN alumnos_extra    ae   ON ae.alumno_id = p.id
  LEFT JOIN profiles         prof ON prof.id = ae.profesor_id
  LEFT JOIN pending_users    pu   ON pu.user_id = p.id
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
$$;
