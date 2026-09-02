-- ============================================================
-- Migration 124: Comunidad Estratégica (Slice 2) — Desafíos
-- ============================================================
-- Creates:
--   1. Enum game_challenge_period_type (weekly | monthly | custom)
--   2. game_challenges          — challenge definitions (criteria JSONB)
--   3. game_challenge_progress  — per-user progress + completion
--   4. challenge_period_bounds() — vigencia window per period_type (Santiago)
--   5. evaluate_challenges_for_event() — evaluates challenges for one event,
--        idempotent per event (last_event_id), caps at target count, sets
--        completed_at once. Returns newly completed challenges.
--   6. Rewires submit_quiz to call evaluate_challenges_for_event.
--   7. get_active_challenges() — active challenges + caller progress.
--
-- No badges are awarded here (Req. 11.3). The completion signal is the
-- NULL->timestamp transition of completed_at (Slice 3 consumes it).
-- All period boundaries use America/Santiago.
-- ============================================================

-- ── 1. Enum ───────────────────────────────────────────────────

CREATE TYPE game_challenge_period_type AS ENUM ('weekly', 'monthly', 'custom');


-- ── 2. game_challenges ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_challenges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant       TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  -- { action_type: game_action_type, count: int>0, category?: qb_categories.id }
  criteria     JSONB NOT NULL,
  period_type  game_challenge_period_type NOT NULL,
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- custom requires a valid explicit window (Req. 9.3).
  CONSTRAINT game_challenges_custom_window CHECK (
    period_type <> 'custom'
    OR (starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at)
  ),
  -- criteria must define a positive count and an action_type.
  CONSTRAINT game_challenges_criteria_valid CHECK (
    (criteria ? 'action_type')
    AND (criteria ? 'count')
    AND ((criteria ->> 'count') ~ '^[0-9]+$')
    AND ((criteria ->> 'count')::int > 0)
  )
);

CREATE INDEX idx_game_challenges_tenant ON game_challenges (tenant);
CREATE INDEX idx_game_challenges_tenant_enabled ON game_challenges (tenant, enabled);

CREATE TRIGGER game_challenges_updated_at
  BEFORE UPDATE ON game_challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE game_challenges ENABLE ROW LEVEL SECURITY;

-- Players with access to the game can read challenges (to show active ones).
CREATE POLICY "game_challenges_select_accessible"
  ON game_challenges FOR SELECT
  TO authenticated
  USING (game_is_accessible(tenant));

-- No client INSERT/UPDATE: admin CRUD is Slice 3 (service role / admin API).


-- ── 3. game_challenge_progress ────────────────────────────────

CREATE TABLE IF NOT EXISTS game_challenge_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant         TEXT NOT NULL,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id   UUID NOT NULL REFERENCES game_challenges(id) ON DELETE CASCADE,
  progress_count INTEGER NOT NULL DEFAULT 0 CHECK (progress_count >= 0),
  completed_at   TIMESTAMPTZ,
  -- Last game_point_events.id applied to this progress row (dedupe, Req. 10.7).
  last_event_id  UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT game_challenge_progress_unique UNIQUE (tenant, user_id, challenge_id)
);

CREATE INDEX idx_game_challenge_progress_user ON game_challenge_progress (tenant, user_id);
CREATE INDEX idx_game_challenge_progress_challenge ON game_challenge_progress (challenge_id);

CREATE TRIGGER game_challenge_progress_updated_at
  BEFORE UPDATE ON game_challenge_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE game_challenge_progress ENABLE ROW LEVEL SECURITY;

-- Users read their own progress.
CREATE POLICY "game_challenge_progress_select_own"
  ON game_challenge_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin reads all progress.
CREATE POLICY "game_challenge_progress_select_admin"
  ON game_challenge_progress FOR SELECT
  TO authenticated
  USING (get_current_user_rol() = 'admin');

-- No client INSERT/UPDATE: only the SECURITY DEFINER engine writes progress.


-- ── 4. challenge_period_bounds ────────────────────────────────
-- Returns the [start, end) vigency window (as timestamptz) for a challenge
-- relative to a reference instant, in America/Santiago. For weekly/monthly
-- the window is the calendar week/month containing p_ref. For custom it is
-- the explicit [starts_at, ends_at).
CREATE OR REPLACE FUNCTION challenge_period_bounds(
  p_period   game_challenge_period_type,
  p_starts_at TIMESTAMPTZ,
  p_ends_at   TIMESTAMPTZ,
  p_ref       TIMESTAMPTZ,
  OUT o_start TIMESTAMPTZ,
  OUT o_end   TIMESTAMPTZ
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_local TIMESTAMP;  -- p_ref as local wall-clock in Santiago
BEGIN
  v_local := timezone('America/Santiago', p_ref);

  IF p_period = 'custom' THEN
    o_start := p_starts_at;
    o_end   := p_ends_at;
  ELSIF p_period = 'weekly' THEN
    -- ISO week: Monday 00:00 (Santiago) to next Monday 00:00.
    o_start := timezone('America/Santiago', date_trunc('week', v_local));
    o_end   := timezone('America/Santiago', date_trunc('week', v_local) + INTERVAL '1 week');
  ELSE -- monthly
    o_start := timezone('America/Santiago', date_trunc('month', v_local));
    o_end   := timezone('America/Santiago', date_trunc('month', v_local) + INTERVAL '1 month');
  END IF;
END;
$$;


-- ── 5. evaluate_challenges_for_event ──────────────────────────
-- Evaluates all enabled challenges of the event's tenant against a single
-- game_point_events row. Runs inside the caller's transaction (Req. 10.4).
-- Returns a JSONB array of challenges newly completed by this event.
CREATE OR REPLACE FUNCTION evaluate_challenges_for_event(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evt        game_point_events%ROWTYPE;
  v_ch         game_challenges%ROWTYPE;
  v_target     INTEGER;
  v_win_start  TIMESTAMPTZ;
  v_win_end    TIMESTAMPTZ;
  v_prog       game_challenge_progress%ROWTYPE;
  v_new_count  INTEGER;
  v_was_null   BOOLEAN;
  v_completed  JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_evt FROM game_point_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN v_completed;
  END IF;

  FOR v_ch IN
    SELECT * FROM game_challenges c
    WHERE c.tenant = v_evt.tenant
      AND c.enabled = true
      AND (c.criteria ->> 'action_type') = v_evt.action_type::text
      AND (
        (c.criteria -> 'category') IS NULL
        OR (c.criteria ->> 'category') = v_evt.category_id::text
      )
  LOOP
    -- Vigency window for this challenge relative to the event instant (Req. 10.8).
    SELECT o_start, o_end INTO v_win_start, v_win_end
    FROM challenge_period_bounds(v_ch.period_type, v_ch.starts_at, v_ch.ends_at, v_evt.occurred_at);

    -- Event outside the vigency window: skip (Req. 10.8).
    CONTINUE WHEN v_win_start IS NULL OR v_win_end IS NULL
      OR v_evt.occurred_at < v_win_start OR v_evt.occurred_at >= v_win_end;

    v_target := (v_ch.criteria ->> 'count')::int;

    -- Load existing progress (if any).
    SELECT * INTO v_prog
    FROM game_challenge_progress
    WHERE tenant = v_evt.tenant AND user_id = v_evt.user_id AND challenge_id = v_ch.id;

    -- Dedupe: this event already applied to this challenge (Req. 10.7).
    IF FOUND AND v_prog.last_event_id IS NOT DISTINCT FROM p_event_id THEN
      CONTINUE;
    END IF;

    -- Already at target: no increment, keep completed_at (Req. 10.5).
    IF FOUND AND v_prog.progress_count >= v_target THEN
      CONTINUE;
    END IF;

    v_was_null := (v_prog.completed_at IS NULL) OR (NOT FOUND);
    v_new_count := LEAST(COALESCE(v_prog.progress_count, 0) + 1, v_target);

    INSERT INTO game_challenge_progress (
      tenant, user_id, challenge_id, progress_count, completed_at, last_event_id
    )
    VALUES (
      v_evt.tenant, v_evt.user_id, v_ch.id, v_new_count,
      CASE WHEN v_new_count >= v_target THEN v_evt.occurred_at ELSE NULL END,
      p_event_id
    )
    ON CONFLICT (tenant, user_id, challenge_id) DO UPDATE SET
      progress_count = v_new_count,
      completed_at   = CASE
        WHEN game_challenge_progress.completed_at IS NOT NULL THEN game_challenge_progress.completed_at
        WHEN v_new_count >= v_target THEN v_evt.occurred_at
        ELSE NULL
      END,
      last_event_id  = p_event_id;

    -- Newly completed by this event (Req. 11.1/11.2/11.4).
    IF v_new_count >= v_target AND v_was_null THEN
      v_completed := v_completed || jsonb_build_object('challenge_id', v_ch.id, 'title', v_ch.title);
    END IF;
  END LOOP;

  RETURN v_completed;
END;
$$;

REVOKE ALL ON FUNCTION evaluate_challenges_for_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION evaluate_challenges_for_event(UUID) TO authenticated;


-- ── 6. Rewire submit_quiz to evaluate challenges ──────────────
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
  v_completed     JSONB := '[]'::jsonb;
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

  SELECT * INTO v_source
  FROM game_point_sources
  WHERE tenant = p_tenant AND action_type = 'quiz_completed';

  IF FOUND AND v_source.enabled THEN
    v_base_points := v_source.points_value;
  ELSE
    v_base_points := 0;
  END IF;

  SELECT COALESCE(scoring_mode, 'fixed') INTO v_scoring
  FROM game_settings WHERE tenant = p_tenant;
  v_scoring := COALESCE(v_scoring, 'fixed');

  IF v_scoring = 'proportional' THEN
    v_points := GREATEST(ROUND(v_base_points * v_aciertos::numeric / v_total)::int, 0);
  ELSE
    v_points := v_base_points;
  END IF;

  INSERT INTO game_point_events (
    tenant, user_id, action_type, points_awarded, source_ref,
    subject_id, category_id, occurred_date
  )
  VALUES (
    p_tenant, v_user_id, 'quiz_completed', v_points, gen_random_uuid()::text,
    p_subject_id, p_category_id, v_today
  )
  RETURNING id INTO v_event_id;

  v_counts_streak := COALESCE(v_source.counts_for_streak, false) AND COALESCE(v_source.enabled, false);
  IF v_counts_streak THEN
    SELECT o_current, o_longest INTO v_new_current, v_new_longest
    FROM apply_streak(p_tenant, v_user_id, v_today);
  END IF;

  -- Evaluate challenges within the same transaction (Req. 10.4).
  v_completed := evaluate_challenges_for_event(v_event_id);

  RETURN jsonb_build_object(
    'ok', true,
    'aciertos', v_aciertos,
    'total_presented', v_total,
    'points_awarded', v_points,
    'scoring_mode', v_scoring,
    'completed_challenges', v_completed
  );
END;
$$;

REVOKE ALL ON FUNCTION submit_quiz(TEXT, UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_quiz(TEXT, UUID, UUID, JSONB) TO authenticated;


-- ── 7. get_active_challenges ──────────────────────────────────
-- Returns enabled challenges whose vigency includes "now" (America/Santiago),
-- with the caller's progress (0 if none) and completed flag.
CREATE OR REPLACE FUNCTION get_active_challenges(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now     TIMESTAMPTZ := now();
  v_result  JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'description', c.description,
      'period_type', c.period_type,
      'target_count', (c.criteria ->> 'count')::int,
      'progress_count', COALESCE(pr.progress_count, 0),
      'completed', pr.completed_at IS NOT NULL
    ) ORDER BY c.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM game_challenges c
  CROSS JOIN LATERAL challenge_period_bounds(c.period_type, c.starts_at, c.ends_at, v_now) b
  LEFT JOIN game_challenge_progress pr
    ON pr.challenge_id = c.id AND pr.tenant = p_tenant AND pr.user_id = v_user_id
  WHERE c.tenant = p_tenant
    AND c.enabled = true
    AND b.o_start IS NOT NULL AND b.o_end IS NOT NULL
    AND v_now >= b.o_start AND v_now < b.o_end;

  RETURN jsonb_build_object('challenges', v_result);
END;
$$;

REVOKE ALL ON FUNCTION get_active_challenges(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_active_challenges(TEXT) TO authenticated;
