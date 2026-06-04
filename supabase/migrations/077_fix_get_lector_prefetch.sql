-- ── 077: Fix get_lector_prefetch ─────────────────────────────────────────
-- La versión anterior retornaba JSON en lugar de JSONB, y usaba json_build_object
-- anidado sin asignar a variable — lo que no propagaba auth.uid() correctamente.
-- El patrón correcto (igual que get_alumno_prefetch) es asignar
-- get_recursos_for_user() a una variable JSONB y retornarla.

DROP FUNCTION IF EXISTS public.get_lector_prefetch(uuid);

CREATE OR REPLACE FUNCTION public.get_lector_prefetch(p_lector_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recursos JSONB;
BEGIN
  -- auth.uid() es el lector cuando se llama desde su sesión autenticada
  v_recursos := get_recursos_for_user();

  RETURN jsonb_build_object(
    'recursos', v_recursos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lector_prefetch(UUID) TO authenticated;
