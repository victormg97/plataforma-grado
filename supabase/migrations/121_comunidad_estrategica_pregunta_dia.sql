-- ============================================================
-- Migration 121: Comunidad Estratégica (Slice 1) — Daily Question
-- ============================================================
-- Creates:
--   1. game_daily_questions       — the question chosen per date/tenant
--   2. select_daily_question()    — lazy, idempotent daily selection
--   3. answer_daily_question()    — atomic answer + points + streak
--   4. game_profiles SELECT policy for accessibility (prepares Slice 2)
--
-- All calendar-day boundaries use America/Santiago.
-- ============================================================

-- ── 1. game_daily_questions ───────────────────────────────────

CREATE TABLE IF NOT EXISTS game_daily_questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant              TEXT NOT NULL,
  -- Calendar date (America/Santiago).
  question_date       DATE NOT NULL,
  -- RESTRICT: an active question already exposed as the daily question
  -- cannot be hard-deleted while referenced.
  question_id         UUID NOT NULL REFERENCES qb_questions(id) ON DELETE RESTRICT,
  -- Allows admin manual curation in a later phase (Req. 5.5).
  is_manually_curated BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- At most one daily question per tenant per date (Req. 5.6).
  CONSTRAINT game_daily_questions_tenant_date_unique UNIQUE (tenant, question_date)
);

CREATE INDEX idx_game_daily_questions_tenant_date ON game_daily_questions (tenant, question_date);

ALTER TABLE game_daily_questions ENABLE ROW LEVEL SECURITY;

-- Readable by anyone with access to the game (same question for all).
CREATE POLICY "game_daily_questions_select_accessible"
  ON game_daily_questions FOR SELECT
  TO authenticated
  USING (game_is_accessible(tenant));

-- No direct client writes: rows are inserted by select_daily_question().


-- ── 2. game_profiles accessibility SELECT policy (Slice 2 prep) ──
-- Players with access to the game can read profiles of their tenant
-- (needed by the future ranking). The mote itself is not sensitive.
CREATE POLICY "game_profiles_select_accessible"
  ON game_profiles FOR SELECT
  TO authenticated
  USING (game_is_accessible(tenant));


-- ── 3. select_daily_question ──────────────────────────────────
-- Lazily selects (once) a random active question for today and returns
-- its id. Idempotent via the unique (tenant, question_date) constraint,
-- so concurrent callers resolve to the same question. Returns NULL when
-- there is no active question (Req. 5.4).
CREATE OR REPLACE FUNCTION select_daily_question(p_tenant TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today       DATE := (timezone('America/Santiago', now()))::date;
  v_question_id UUID;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Try to register today's question if not present yet.
  INSERT INTO game_daily_questions (tenant, question_date, question_id, is_manually_curated)
  SELECT p_tenant, v_today, q.id, false
  FROM qb_questions q
  WHERE q.tenant = p_tenant AND q.status = 'active'
  ORDER BY random()
  LIMIT 1
  ON CONFLICT (tenant, question_date) DO NOTHING;

  -- Read whatever ended up registered for today (may be NULL if no active questions).
  SELECT question_id INTO v_question_id
  FROM game_daily_questions
  WHERE tenant = p_tenant AND question_date = v_today;

  RETURN v_question_id;
END;
$$;

REVOKE ALL ON FUNCTION select_daily_question(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION select_daily_question(TEXT) TO authenticated;


-- ── 4. answer_daily_question ──────────────────────────────────
-- Atomically: evaluates the answer by question type, awards points via
-- the configured source, updates the streak (America/Santiago), and
-- records the audit event. Idempotent per user/day via the partial
-- unique index on game_point_events.
--
-- p_answer payloads:
--   single_choice / multiple_choice : { "selected": [<option index>, ...] }
--   true_false                      : { "value": true|false }
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

  -- Resolve today's question (lazy select).
  v_question_id := select_daily_question(p_tenant);
  IF v_question_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_DAILY_QUESTION');
  END IF;

  SELECT type, options, explanation
  INTO v_qtype, v_options, v_explanation
  FROM qb_questions
  WHERE id = v_question_id;

  -- ── Evaluate correctness by type ────────────────────────────
  IF v_qtype IN ('single_choice', 'multiple_choice') THEN
    -- Correct set = indices where is_correct = true.
    SELECT COALESCE(array_agg(ord ORDER BY ord), '{}')
    INTO v_correct_set
    FROM (
      SELECT (idx - 1) AS ord
      FROM jsonb_array_elements(v_options) WITH ORDINALITY AS o(elem, idx)
      WHERE COALESCE((o.elem ->> 'is_correct')::boolean, false)
    ) c;

    -- Selected set from payload.
    SELECT COALESCE(array_agg(DISTINCT (val)::int ORDER BY (val)::int), '{}')
    INTO v_selected_set
    FROM jsonb_array_elements_text(COALESCE(p_answer -> 'selected', '[]'::jsonb)) AS val;

    -- Exact set match (Req. 5.9 / 5.10).
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
    -- Other types are not gradable as daily question in Slice 1.
    v_is_correct := false;
  END IF;

  -- ── Points source lookup (Req. 2.3 / 2.4) ───────────────────
  SELECT * INTO v_source
  FROM game_point_sources
  WHERE tenant = p_tenant AND action_type = 'daily_question_answered';

  IF FOUND AND v_source.enabled THEN
    v_points := v_source.points_value;
  ELSE
    v_points := 0;
  END IF;
  v_counts_streak := COALESCE(v_source.counts_for_streak, false) AND COALESCE(v_source.enabled, false);

  -- ── Record participation event (idempotent per user/day) ────
  -- source_ref = today's question_id; partial unique index guards dupes.
  INSERT INTO game_point_events (tenant, user_id, action_type, points_awarded, source_ref, occurred_date)
  VALUES (p_tenant, v_user_id, 'daily_question_answered', v_points, v_question_id::text, v_today)
  ON CONFLICT (tenant, user_id, action_type, source_ref)
    WHERE action_type = 'daily_question_answered'
  DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    -- Already answered today: no additional points/streak (Req. 5.8).
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

  -- ── Streak update (Req. 4.3-4.9), only if source counts for streak ──
  -- Ensure a profile row exists (nickname may still be NULL).
  INSERT INTO game_profiles (user_id, tenant)
  VALUES (v_user_id, p_tenant)
  ON CONFLICT (tenant, user_id) DO NOTHING;

  SELECT * INTO v_profile FROM game_profiles WHERE tenant = p_tenant AND user_id = v_user_id;

  v_new_current := v_profile.current_streak;
  v_new_longest := v_profile.longest_streak;

  IF v_counts_streak THEN
    IF v_profile.last_activity_date IS NULL THEN
      v_new_current := 1;
    ELSIF v_profile.last_activity_date = v_today THEN
      v_new_current := GREATEST(v_profile.current_streak, 1);
    ELSIF v_profile.last_activity_date = (v_today - 1) THEN
      v_new_current := v_profile.current_streak + 1;
    ELSE
      -- Gap greater than one calendar day: reset (Req. 4.6).
      v_new_current := 1;
    END IF;

    v_new_longest := GREATEST(v_profile.longest_streak, v_new_current);

    UPDATE game_profiles
    SET current_streak     = v_new_current,
        longest_streak     = v_new_longest,
        last_activity_date = v_today
    WHERE tenant = p_tenant AND user_id = v_user_id;
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
