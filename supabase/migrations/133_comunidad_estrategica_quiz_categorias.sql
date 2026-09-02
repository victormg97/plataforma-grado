-- Migration 133: Comunidad Estratégica — Quiz: categorías por materia
-- ============================================================
-- get_quiz_categories(p_tenant, p_subject_id): lista las categorías de una
-- materia que tienen al menos una pregunta activa. Usado por el selector de
-- categoría en la UI del cuestionario. Devuelve el nombre y conteo desde DB
-- (nada en duro). game_is_accessible requerido.
-- ============================================================

CREATE OR REPLACE FUNCTION get_quiz_categories(p_tenant TEXT, p_subject_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cat.id,
      'name', cat.name,
      'active_question_count', cat.cnt
    ) ORDER BY cat.name
  ), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT c.id, c.name, count(q.id) AS cnt
    FROM qb_categories c
    JOIN qb_questions q
      ON q.category_id = c.id
     AND q.tenant = p_tenant
     AND q.status = 'active'
     AND q.subject_id = p_subject_id
    WHERE c.tenant = p_tenant
    GROUP BY c.id, c.name
    HAVING count(q.id) > 0
  ) cat;

  RETURN jsonb_build_object('categories', v_result);
END;
$$;

REVOKE ALL ON FUNCTION get_quiz_categories(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_quiz_categories(TEXT, UUID) TO authenticated;
