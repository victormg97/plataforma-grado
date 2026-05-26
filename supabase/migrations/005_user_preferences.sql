-- Add user preference columns to profiles
-- idioma: NULL = not set (defaults to 'es' in app), 'es' | 'en' | future locales
-- tema:   NULL = not set (defaults to 'light' in app), 'light' | 'dark'
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS idioma text,
  ADD COLUMN IF NOT EXISTS tema   text;

-- Stored procedure: get_admin_init_data
-- Returns all alumnos (with extra + assigned professor) and all profesores
-- in a single round-trip for server-side prefetching.
CREATE OR REPLACE FUNCTION get_admin_init_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alumnos    json;
  v_profesores json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id',           p.id,
      'nombre',       p.nombre,
      'apellido',     p.apellido,
      'email',        p.email,
      'telefono',     p.telefono,
      'avatar_url',   p.avatar_url,
      'activo',       p.activo,
      'profesor_id',  ae.profesor_id,
      'profesor',     CASE WHEN pr.id IS NOT NULL
                        THEN json_build_object('id', pr.id, 'nombre', pr.nombre, 'apellido', pr.apellido)
                        ELSE NULL END,
      'universidad',  ae.universidad,
      'año_ingreso',  ae.año_ingreso,
      'notas',        ae.notas,
      'paso_prueba',  COALESCE(ae.paso_prueba, false),
      'fecha_prueba', ae.fecha_prueba
    )
    ORDER BY p.nombre
  )
  INTO v_alumnos
  FROM profiles p
  LEFT JOIN alumnos_extra ae ON ae.alumno_id = p.id
  LEFT JOIN profiles pr ON pr.id = ae.profesor_id
  WHERE p.rol = 'alumno';

  SELECT json_agg(
    json_build_object(
      'id',         p.id,
      'nombre',     p.nombre,
      'apellido',   p.apellido,
      'email',      p.email,
      'telefono',   p.telefono,
      'avatar_url', p.avatar_url,
      'activo',     p.activo,
      'rol',        p.rol
    )
    ORDER BY p.nombre
  )
  INTO v_profesores
  FROM profiles p
  WHERE p.rol = 'profesor';

  RETURN json_build_object(
    'alumnos',    COALESCE(v_alumnos, '[]'::json),
    'profesores', COALESCE(v_profesores, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_init_data() TO authenticated;
