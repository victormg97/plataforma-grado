-- ============================================================
-- 058_propagate_folder_permissions_recursive.sql
-- RPC to recursively propagate permissions from a folder
-- to ALL resources inside it and all its subfolders.
-- ============================================================

CREATE OR REPLACE FUNCTION public.propagate_folder_permissions(
  p_folder_id   uuid,
  p_para_todos     boolean,
  p_para_todos_app boolean,
  p_alumno_ids     uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_resource_ids uuid[];
BEGIN
  -- 1. Collect ALL resource IDs in the folder tree (recursive)
  WITH RECURSIVE folder_tree AS (
    SELECT id FROM public.carpetas_recursos WHERE id = p_folder_id
    UNION ALL
    SELECT cr.id
    FROM public.carpetas_recursos cr
    INNER JOIN folder_tree ft ON cr.parent_id = ft.id
  )
  SELECT ARRAY(
    SELECT rc.id
    FROM public.recursos_compartidos rc
    WHERE rc.carpeta_id IN (SELECT id FROM folder_tree)
  ) INTO v_resource_ids;

  -- Nothing to do if no resources found
  IF array_length(v_resource_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- 2. Update para_todos and para_todos_app on all resources
  UPDATE public.recursos_compartidos
  SET para_todos     = p_para_todos,
      para_todos_app = p_para_todos_app
  WHERE id = ANY(v_resource_ids);

  -- 3. Delete all existing acceso records for these resources
  DELETE FROM public.recursos_acceso
  WHERE recurso_id = ANY(v_resource_ids);

  -- 4. Re-insert acceso records if specific alumnos chosen
  IF NOT p_para_todos AND NOT p_para_todos_app AND array_length(p_alumno_ids, 1) > 0 THEN
    INSERT INTO public.recursos_acceso (recurso_id, alumno_id)
    SELECT r.id, a.id
    FROM unnest(v_resource_ids) AS r(id)
    CROSS JOIN unnest(p_alumno_ids) AS a(id)
    ON CONFLICT (recurso_id, alumno_id) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.propagate_folder_permissions(uuid, boolean, boolean, uuid[]) TO authenticated;
