-- =============================================================================
-- 158: get_cedularios_alumnos_resumen
-- Active cedulario assignments per alumno, for the admin Alumnos list cards
-- ("Cedulario activo" / "Asignar cedulario"). One RPC for the whole list.
-- Alumnos without active assignments are absent from the result (count 0).
-- SECURITY INVOKER: RLS decides which assignments the caller sees (admin: all;
-- profesor: their alumnos; alumno: their own).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_cedularios_alumnos_resumen()
RETURNS TABLE (
  alumno_id    uuid,
  total_activas integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.alumno_id,
         count(*)::integer
  FROM public.cedulario_asignaciones a
  JOIN public.profiles p ON p.id = a.alumno_id AND p.rol = 'alumno'
  WHERE a.estado = 'activa'
  GROUP BY a.alumno_id;
$$;

REVOKE ALL ON FUNCTION public.get_cedularios_alumnos_resumen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cedularios_alumnos_resumen() TO authenticated;
