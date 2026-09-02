-- ============================================================
-- Migration 125: Comunidad Estratégica (Slice 2) — Quiz subjects RPC
-- ============================================================
-- get_quiz_subjects(): lists subjects of the tenant that have at least one
-- active question, with the active question count and the effective quiz
-- question count (per-subject override > global). SECURITY DEFINER so that
-- players (who cannot read qb_* directly) can drive the quiz subject picker,
-- guarded by game_is_accessible.
-- ============================================================

CREATE OR REPLACE FUNCTION get_quiz_subjects(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_global INTEGER;
  v_result JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(quiz_question_count, 10) INTO v_global
  FROM game_settings WHERE tenant = p_tenant;
  v_global := COALESCE(v_global, 10);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'active_question_count', s.cnt,
      'effective_question_count', COALESCE(ov.quiz_question_count, v_global)
    ) ORDER BY s.name
  ), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT sub.id, sub.name, count(q.id) AS cnt
    FROM qb_subjects sub
    JOIN qb_questions q
      ON q.subject_id = sub.id
     AND q.tenant = p_tenant
     AND q.status = 'active'
    WHERE sub.tenant = p_tenant
    GROUP BY sub.id, sub.name
    HAVING count(q.id) > 0
  ) s
  LEFT JOIN game_quiz_subject_settings ov
    ON ov.tenant = p_tenant AND ov.subject_id = s.id;

  RETURN jsonb_build_object('subjects', v_result);
END;
$$;

REVOKE ALL ON FUNCTION get_quiz_subjects(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_quiz_subjects(TEXT) TO authenticated;
