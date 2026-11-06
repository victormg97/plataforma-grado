-- =============================================================================
-- 153_cedulario_creador_rpc.sql
--
-- obtener_creador_cedulario: name of the creator of a cedulario.
--
-- A profesor cannot read other profiles through RLS (admin profiles are not
-- readable by profesores), so the creator name cannot be embedded in the
-- cedulario query. This SECURITY DEFINER RPC returns only id, nombre and
-- apellido of cedularios.created_by.
--
-- Rules:
--   - Only admin and profesor get a row; any other role (or no session) gets
--     no rows.
--   - The cedulario must be visible to the caller: active, or the caller is
--     admin.
--   - No rows when created_by is NULL or the profile no longer exists.
--
-- Idempotent: CREATE OR REPLACE plus REVOKE / GRANT. Same grant pattern as
-- migration 152 (Supabase default privileges grant EXECUTE to anon, so anon is
-- named in the REVOKE).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.obtener_creador_cedulario(p_cedulario_id uuid)
RETURNS TABLE (
  id       uuid,
  nombre   text,
  apellido text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
BEGIN
  v_rol := public.get_user_rol()::text;

  IF auth.uid() IS NULL OR v_rol IS NULL OR v_rol NOT IN ('admin', 'profesor') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.nombre,
         p.apellido
  FROM public.cedularios c
  JOIN public.profiles p ON p.id = c.created_by
  WHERE c.id = p_cedulario_id
    AND (c.activo OR v_rol = 'admin');
END;
$$;

REVOKE ALL ON FUNCTION public.obtener_creador_cedulario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obtener_creador_cedulario(uuid) TO authenticated;
