-- ============================================================
-- Migration 122: Comunidad Estratégica (Slice 2) — Cuestionarios
-- ============================================================
-- Builds on Slice 1 (migrations 118-121). Adds:
--   1. Enum game_scoring_mode (fixed | proportional)
--   2. game_settings: quiz_question_count, scoring_mode, show_real_name
--   3. game_quiz_subject_settings — per-subject question-count override
--   4. game_point_events: subject_id / category_id + monthly index
--   5. apply_streak() — streak logic extracted from Slice 1 (no behavior
--      change) so quiz + daily question share a single rule source
--   6. start_quiz()  — select active questions for a subject/category
--   7. submit_quiz() — evaluate, score (fixed/proportional), record event
--
-- quiz_completed already exists in game_action_type (migration 118); it is
-- activated here by enabling its game_point_sources row for the tenant.
-- Challenge evaluation is wired into submit_quiz in migration 124.
-- All calendar boundaries use America/Santiago.
-- ============================================================

-- ── 1. Enum ───────────────────────────────────────────────────

CREATE TYPE game_scoring_mode AS ENUM ('fixed', 'proportional');


-- ── 2. game_settings: quiz + ranking config ──────────────────

ALTER TABLE game_settings
  ADD COLUMN IF NOT EXISTS quiz_question_count INTEGER NOT NULL DEFAULT 10 CHECK (quiz_question_count > 0),
  ADD COLUMN IF NOT EXISTS scoring_mode        game_scoring_mode NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS show_real_name      BOOLEAN NOT NULL DEFAULT false;


-- ── 3. game_quiz_subject_settings (per-subject count override) ─

CREATE TABLE IF NOT EXISTS game_quiz_subject_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant              TEXT NOT NULL,
  subject_id          UUID NOT NULL REFERENCES qb_subjects(id) ON DELETE CASCADE,
  quiz_question_count INTEGER NOT NULL CHECK (quiz_question_count > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT game_quiz_subject_settings_tenant_subject_unique UNIQUE (tenant, subject_id)
);

CREATE INDEX idx_game_quiz_subject_settings_tenant ON game_quiz_subject_settings (tenant);

CREATE TRIGGER game_quiz_subject_settings_updated_at
  BEFORE UPDATE ON game_quiz_subject_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE game_quiz_subject_settings ENABLE ROW LEVEL SECURITY;

-- Readable by authenticated users (player quiz UI needs the effective count).
CREATE POLICY "game_quiz_subject_settings_select_authenticated"
  ON game_quiz_subject_settings FOR SELECT
  TO authenticated
  USING (true);

-- Mutations via service role / admin API only (admin CRUD is Slice 3).


-- ── 4. game_point_events: quiz references + monthly index ─────

ALTER TABLE game_point_events
  ADD COLUMN IF NOT EXISTS subject_id  UUID REFERENCES qb_subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES qb_categories(id) ON DELETE SET NULL;

-- Aggregation index for the monthly ranking.
CREATE INDEX IF NOT EXISTS idx_game_point_events_tenant_occurred
  ON game_point_events (tenant, occurred_at);


-- ── 5. apply_streak (extracted from Slice 1, no behavior change) ──
-- Updates current/longest streak for a user given "today" (America/Santiago),
-- following the exact rules of Req. 4.3-4.9. Ensures a profile row exists.
-- Returns the resulting (current, longest) via OUT params.
CREATE OR REPLACE FUNCTION apply_streak(
  p_tenant  TEXT,
  p_user_id UUID,
  p_today   DATE,
  OUT o_current INTEGER,
  OUT o_longest INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile game_profiles%ROWTYPE;
BEGIN
  -- Ensure a profile row exists (nickname may still be NULL).
  INSERT INTO game_profiles (user_id, tenant)
  VALUES (p_user_id, p_tenant)
  ON CONFLICT (tenant, user_id) DO NOTHING;

  SELECT * INTO v_profile FROM game_profiles WHERE tenant = p_tenant AND user_id = p_user_id;

  IF v_profile.last_activity_date IS NULL THEN
    o_current := 1;
  ELSIF v_profile.last_activity_date = p_today THEN
    o_current := GREATEST(v_profile.current_streak, 1);
  ELSIF v_profile.last_activity_date = (p_today - 1) THEN
    o_current := v_profile.current_streak + 1;
  ELSE
    -- Gap greater than one calendar day: reset (Req. 4.6).
    o_current := 1;
  END IF;

  o_longest := GREATEST(v_profile.longest_streak, o_current);

  UPDATE game_profiles
  SET current_streak     = o_current,
      longest_streak     = o_longest,
      last_activity_date = p_today
  WHERE tenant = p_tenant AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION apply_streak(TEXT, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_streak(TEXT, UUID, DATE) TO authenticated;


-- Rewire answer_daily_question to use apply_streak (behavior identical).
CREATE OR REPLACE FUNCTION answer_daily_question(
  p_tenant TEXT,
  p_answer JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_today          DATE := (timezone('America/Santiago', now()))::date;
  v_question_id    UUID;
  v_qtype          qb_question_type;
  v_options        JSONB;
  v_explanation    TEXT;
  v_is_correct     BOOLEAN := false;
  v_correct_set    INT[];
  v_selected_set   INT[];
  v_tf_correct     BOOLEAN;
  v_tf_value       BOOLEAN;
  v_source         game_point_sources%ROWTYPE;
  v_points         INTEGER := 0;
  v_counts_streak  BOOLEAN := false;
  v_inserted       BIGINT := 0;
  v_profile        game_profiles%ROWTYPE;
  v_new_current    INTEGER;
  v_new_longest    INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_question_id := select_daily_question(p_tenant);
  IF v_question_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_DAILY_QUESTION');
  END IF;

  SELECT type, options, explanation
  INTO v_qtype, v_options, v_explanation
  FROM qb_questions
  WHERE id = v_question_id;

  IF v_qtype IN ('single_choice', 'multiple_choice') THEN
    SELECT COALESCE(array_agg(ord ORDER BY ord), '{}')
    INTO v_correct_set
    FROM (
      SELECT (idx - 1) AS ord
      FROM jsonb_array_elements(v_options) WITH ORDINALITY AS o(elem, idx)
      WHERE COALESCE((o.elem ->> 'is_correct')::boolean, false)
    ) c;

    SELECT COALESCE(array_agg(DISTINCT (val)::int ORDER BY (val)::int), '{}')
    INTO v_selected_set
    FROM jsonb_array_elements_text(COALESCE(p_answer -> 'selected', '[]'::jsonb)) AS val;

    v_is_correct := (v_selected_set = v_correct_set);

  ELSIF v_qtype = 'true_false' THEN
    v_tf_correct := COALESCE((v_options ->> 'correct_answer')::boolean, false);
    IF (p_answer ? 'value') THEN
      v_tf_value := (p_answer ->> 'value')::boolean;
      v_is_correct := (v_tf_value = v_tf_correct);
    ELSE
      v_is_correct := false;
    END IF;

  ELSE
    v_is_correct := false;
  END IF;

  SELECT * INTO v_source
  FROM game_point_sources
  WHERE tenant = p_tenant AND action_type = 'daily_question_answered';

  IF FOUND AND v_source.enabled THEN
    v_points := v_source.points_value;
  ELSE
    v_points := 0;
  END IF;
  v_counts_streak := COALESCE(v_source.counts_for_streak, false) AND COALESCE(v_source.enabled, false);

  INSERT INTO game_point_events (tenant, user_id, action_type, points_awarded, source_ref, occurred_date)
  VALUES (p_tenant, v_user_id, 'daily_question_answered', v_points, v_question_id::text, v_today)
  ON CONFLICT (tenant, user_id, action_type, source_ref)
    WHERE action_type = 'daily_question_answered'
  DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_profile FROM game_profiles WHERE tenant = p_tenant AND user_id = v_user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'already_answered', true,
      'is_correct', v_is_correct,
      'explanation', CASE WHEN v_explanation IS NOT NULL AND v_explanation <> '' THEN v_explanation ELSE NULL END,
      'points_awarded', 0,
      'current_streak', COALESCE(v_profile.current_streak, 0),
      'longest_streak', COALESCE(v_profile.longest_streak, 0)
    );
  END IF;

  -- Streak update via shared helper (Req. 4.3-4.9), only if source counts.
  IF v_counts_streak THEN
    SELECT o_current, o_longest INTO v_new_current, v_new_longest
    FROM apply_streak(p_tenant, v_user_id, v_today);
  ELSE
    -- Ensure profile exists; keep current streak values.
    INSERT INTO game_profiles (user_id, tenant)
    VALUES (v_user_id, p_tenant)
    ON CONFLICT (tenant, user_id) DO NOTHING;
    SELECT current_streak, longest_streak INTO v_new_current, v_new_longest
    FROM game_profiles WHERE tenant = p_tenant AND user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_answered', false,
    'is_correct', v_is_correct,
    'explanation', CASE WHEN v_explanation IS NOT NULL AND v_explanation <> '' THEN v_explanation ELSE NULL END,
    'points_awarded', v_points,
    'current_streak', v_new_current,
    'longest_streak', v_new_longest
  );
END;
$$;

REVOKE ALL ON FUNCTION answer_daily_question(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION answer_daily_question(TEXT, JSONB) TO authenticated;


-- ── 6. start_quiz ─────────────────────────────────────────────
-- Selects active questions for a subject (optionally a category) up to the
-- effective question count (per-subject override > global). Does NOT expose
-- which option is correct. Returns NO_QUESTIONS when none are available.
CREATE OR REPLACE FUNCTION start_quiz(
  p_tenant      TEXT,
  p_subject_id  UUID,
  p_category_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count       INTEGER;
  v_available   INTEGER;
  v_take        INTEGER;
  v_questions   JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Effective count: per-subject override > global > fallback 10 (Req. 1.3/1.4).
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

  -- Select questions WITHOUT exposing correctness (only option text).
  SELECT jsonb_agg(row_to_json(sub.*))
  INTO v_questions
  FROM (
    SELECT
      q.id,
      q.type,
      q.content,
      CASE
        WHEN q.type = 'true_false' THEN '{}'::jsonb
        ELSE COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('text', elem ->> 'text'))
             FROM jsonb_array_elements(q.options) AS elem),
          '[]'::jsonb
        )
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
$$;

REVOKE ALL ON FUNCTION start_quiz(TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_quiz(TEXT, UUID, UUID) TO authenticated;


-- ── 7. submit_quiz ────────────────────────────────────────────
-- Evaluates answers server-side (Slice 1 rules), scores per scoring_mode,
-- records a quiz_completed event with subject/category refs, updates streak
-- via apply_streak (only if the source counts), then evaluates challenges
-- (wired in migration 124). Runs in a single transaction.
--
-- p_answers: array of { "question_id": uuid, "selected": int[] } (choice)
--            or        { "question_id": uuid, "value": bool }     (true_false)
CREATE OR REPLACE FUNCTION submit_quiz(
  p_tenant      TEXT,
  p_subject_id  UUID,
  p_category_id UUID,
  p_answers     JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_today         DATE := (timezone('America/Santiago', now()))::date;
  v_ans           JSONB;
  v_qid           UUID;
  v_qtype         qb_question_type;
  v_options       JSONB;
  v_correct_set   INT[];
  v_selected_set  INT[];
  v_tf_correct    BOOLEAN;
  v_is_correct    BOOLEAN;
  v_total         INTEGER := 0;
  v_aciertos      INTEGER := 0;
  v_source        game_point_sources%ROWTYPE;
  v_base_points   INTEGER := 0;
  v_scoring       game_scoring_mode;
  v_points        INTEGER := 0;
  v_event_id      UUID;
  v_counts_streak BOOLEAN := false;
  v_new_current   INTEGER;
  v_new_longest   INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_ANSWERS');
  END IF;

  -- Evaluate each answer against active questions of this subject/category.
  FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_qid := (v_ans ->> 'question_id')::uuid;

    SELECT type, options INTO v_qtype, v_options
    FROM qb_questions
    WHERE id = v_qid
      AND tenant = p_tenant
      AND status = 'active'
      AND subject_id = p_subject_id
      AND (p_category_id IS NULL OR category_id = p_category_id);

    -- Skip ids that don't belong to the active set (defensive).
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_total := v_total + 1;
    v_is_correct := false;

    IF v_qtype IN ('single_choice', 'multiple_choice') THEN
      SELECT COALESCE(array_agg(ord ORDER BY ord), '{}')
      INTO v_correct_set
      FROM (
        SELECT (idx - 1) AS ord
        FROM jsonb_array_elements(v_options) WITH ORDINALITY AS o(elem, idx)
        WHERE COALESCE((o.elem ->> 'is_correct')::boolean, false)
      ) c;

      SELECT COALESCE(array_agg(DISTINCT (val)::int ORDER BY (val)::int), '{}')
      INTO v_selected_set
      FROM jsonb_array_elements_text(COALESCE(v_ans -> 'selected', '[]'::jsonb)) AS val;

      v_is_correct := (v_selected_set = v_correct_set);

    ELSIF v_qtype = 'true_false' THEN
      v_tf_correct := COALESCE((v_options ->> 'correct_answer')::boolean, false);
      IF (v_ans ? 'value') THEN
        v_is_correct := ((v_ans ->> 'value')::boolean = v_tf_correct);
      END IF;
    END IF;

    IF v_is_correct THEN
      v_aciertos := v_aciertos + 1;
    END IF;
  END LOOP;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_QUESTIONS');
  END IF;

  -- Scoring (Req. 3).
  SELECT * INTO v_source
  FROM game_point_sources
  WHERE tenant = p_tenant AND action_type = 'quiz_completed';

  IF FOUND AND v_source.enabled THEN
    v_base_points := v_source.points_value;
  ELSE
    v_base_points := 0;  -- disabled: register completion with 0 points (Req. 3.6)
  END IF;

  SELECT COALESCE(scoring_mode, 'fixed') INTO v_scoring
  FROM game_settings WHERE tenant = p_tenant;
  v_scoring := COALESCE(v_scoring, 'fixed');

  IF v_scoring = 'proportional' THEN
    v_points := GREATEST(ROUND(v_base_points * v_aciertos::numeric / v_total)::int, 0);
  ELSE
    v_points := v_base_points;
  END IF;

  -- Record the quiz_completed event (Req. 4). Not unique per day: each
  -- completion is an independent event (Req. 4.3).
  INSERT INTO game_point_events (
    tenant, user_id, action_type, points_awarded, source_ref,
    subject_id, category_id, occurred_date
  )
  VALUES (
    p_tenant, v_user_id, 'quiz_completed', v_points, gen_random_uuid()::text,
    p_subject_id, p_category_id, v_today
  )
  RETURNING id INTO v_event_id;

  -- Streak (only if quiz_completed counts for streak).
  v_counts_streak := COALESCE(v_source.counts_for_streak, false) AND COALESCE(v_source.enabled, false);
  IF v_counts_streak THEN
    SELECT o_current, o_longest INTO v_new_current, v_new_longest
    FROM apply_streak(p_tenant, v_user_id, v_today);
  END IF;

  -- Challenge evaluation is wired in migration 124 (evaluate_challenges_for_event).
  -- Placeholder returns empty until that migration replaces this function body.

  RETURN jsonb_build_object(
    'ok', true,
    'aciertos', v_aciertos,
    'total_presented', v_total,
    'points_awarded', v_points,
    'scoring_mode', v_scoring,
    'completed_challenges', '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION submit_quiz(TEXT, UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_quiz(TEXT, UUID, UUID, JSONB) TO authenticated;


-- ── 8. Activate quiz_completed points source for the tenant ───

UPDATE game_point_sources
SET points_value = 20, enabled = true
WHERE tenant = 'pregunta-estrategica' AND action_type = 'quiz_completed';
