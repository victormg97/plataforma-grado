-- 138_comunidad_estrategica_start_quiz_options_guard.sql
--
-- Fix: start_quiz raised "cannot extract elements from an object" when a
-- subject (e.g. picked via "All categories") contained a question whose
-- `options` is a JSON object rather than an array (matching questions, and
-- true_false stored as an object). The previous CASE only special-cased
-- `type = 'true_false'`, so a `matching` question with an object options
-- payload hit jsonb_array_elements() on a non-array and errored.
--
-- Guard on the ACTUAL json type of `options` (must be 'array') before
-- iterating; otherwise return an empty options array. Choice options are the
-- only ones the player quiz UI renders, so non-array option payloads carry no
-- client-facing option data anyway.

CREATE OR REPLACE FUNCTION public.start_quiz(p_tenant text, p_subject_id uuid, p_category_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count       INTEGER;
  v_available   INTEGER;
  v_take        INTEGER;
  v_questions   JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    (SELECT quiz_question_count FROM game_quiz_subject_settings
      WHERE tenant = p_tenant AND subject_id = p_subject_id),
    (SELECT quiz_question_count FROM game_settings WHERE tenant = p_tenant),
    10
  ) INTO v_count;

  SELECT count(*) INTO v_available
  FROM qb_questions q
  WHERE q.tenant = p_tenant
    AND q.status = 'active'
    AND q.subject_id = p_subject_id
    AND (p_category_id IS NULL OR q.category_id = p_category_id);

  IF v_available = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_QUESTIONS');
  END IF;

  v_take := LEAST(v_count, v_available);

  SELECT jsonb_agg(row_to_json(sub.*))
  INTO v_questions
  FROM (
    SELECT
      q.id,
      q.type,
      q.content,
      CASE
        WHEN jsonb_typeof(q.options) = 'array' THEN COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('text', elem ->> 'text'))
             FROM jsonb_array_elements(q.options) AS elem),
          '[]'::jsonb
        )
        ELSE '[]'::jsonb
      END AS options
    FROM qb_questions q
    WHERE q.tenant = p_tenant
      AND q.status = 'active'
      AND q.subject_id = p_subject_id
      AND (p_category_id IS NULL OR q.category_id = p_category_id)
    ORDER BY random()
    LIMIT v_take
  ) sub;

  RETURN jsonb_build_object(
    'ok', true,
    'subject_id', p_subject_id,
    'category_id', p_category_id,
    'question_count', v_take,
    'questions', COALESCE(v_questions, '[]'::jsonb)
  );
END;
$function$;
