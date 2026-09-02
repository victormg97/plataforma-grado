-- ============================================================
-- Migration 126: Comunidad Estratégica (Slice 3) — Insignias
-- ============================================================
-- Builds on Slices 1-2 (migrations 118-125). Adds the badge system:
--   1. Enums game_badge_unlock_type / game_badge_grant_method
--   2. game_badges  — badge definitions (criteria JSONB, series, audience)
--   3. user_badges  — per-user grants (UNIQUE user/badge = idempotent)
--   4. game_settings: badge image validation config (Req. 2.7)
--   5. award_badge()                    — idempotent grant helper
--   6. evaluate_badges_for_event()      — automatic badges by point event
--   7. evaluate_badges_for_streak()     — automatic badges by streak
--   8. evaluate_badges_for_challenge()  + AFTER UPDATE trigger on
--        game_challenge_progress.completed_at (NULL -> timestamp)
--   9. backfill_badge()                 — retroactive grants (Req. 4)
--  10. grant_badge_manual()             — admin manual grant (Req. 5)
--  11. delete_badge()                   — safe delete (Req. 8)
--  12. get_user_badges()               — player showcase (Req. 7)
--  13. Rewire submit_quiz / answer_daily_question to fire the evaluators
--  14. Storage bucket 'game-badges' + policies
--
-- The engine CONSUMES existing signals (events, challenge completion,
-- streak); it does not create new progress sources. Uniqueness of the
-- (tenant, user_id, badge_id) pair guarantees at most one grant per
-- pair across concurrent/automatic/retroactive/manual paths.
-- Nothing tenant/role specific is hardcoded; audience is validated
-- against the real user_rol enum via get_current_user_rol().
-- All calendar boundaries use America/Santiago.
-- ============================================================

-- ── 1. Enums ──────────────────────────────────────────────────

CREATE TYPE game_badge_unlock_type  AS ENUM ('automatic', 'manual');
CREATE TYPE game_badge_grant_method AS ENUM ('automatic', 'manual');


-- ── 2. game_badges ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_badges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant        TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  -- Storage path in the 'game-badges' bucket (nullable until uploaded).
  image_path    TEXT,
  -- Roles this badge applies to; values from the real user_rol enum.
  audience      TEXT[] NOT NULL DEFAULT '{}',
  unlock_type   game_badge_unlock_type NOT NULL,
  -- { type: 'streak_reached'|'quiz_completed_count'|'weekly_case_count'
  --        |'subject_max_score'|'challenges_completed'|'interrogacion_count', ... }
  criteria      JSONB,
  -- Progression: badges sharing a series_key are levels ordered by series_order.
  series_key    TEXT,
  series_order  INTEGER,
  hide_criteria BOOLEAN NOT NULL DEFAULT false,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  -- Soft-delete marker for badges that were already unlocked (Req. 8.2).
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Automatic badges require a criteria (Req. 1.5).
  CONSTRAINT game_badges_automatic_criteria CHECK (
    unlock_type <> 'automatic' OR criteria IS NOT NULL
  ),
  -- A badge in a series must have an order (Req. 6.1/6.2).
  CONSTRAINT game_badges_series_order CHECK (
    series_key IS NULL OR series_order IS NOT NULL
  )
);

CREATE INDEX idx_game_badges_tenant ON game_badges (tenant);
CREATE INDEX idx_game_badges_tenant_active ON game_badges (tenant, enabled, unlock_type);
CREATE INDEX idx_game_badges_series ON game_badges (tenant, series_key, series_order);

CREATE TRIGGER game_badges_updated_at
  BEFORE UPDATE ON game_badges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE game_badges ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read badges (showcase filtering lives in the RPC).
CREATE POLICY "game_badges_select_authenticated"
  ON game_badges FOR SELECT
  TO authenticated
  USING (true);

-- No client INSERT/UPDATE/DELETE: admin CRUD via service role / RPC.


-- ── 3. user_badges ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_badges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant       TEXT NOT NULL,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- RESTRICT: a badge with grants cannot be hard-deleted (Req. 8 -> soft-delete).
  badge_id     UUID NOT NULL REFERENCES game_badges(id) ON DELETE RESTRICT,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL for automatic grants (Req. 3.6); admin id for manual (Req. 5.1).
  granted_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  grant_method game_badge_grant_method NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Uniqueness of the (user, badge) pair (Req. 3.9 / 5.5).
  CONSTRAINT user_badges_unique UNIQUE (tenant, user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges (tenant, user_id);
CREATE INDEX idx_user_badges_badge ON user_badges (badge_id);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Users read their own badges (showcase).
CREATE POLICY "user_badges_select_own"
  ON user_badges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin reads all grants (stats / manual grant UI).
CREATE POLICY "user_badges_select_admin"
  ON user_badges FOR SELECT
  TO authenticated
  USING (get_current_user_rol() = 'admin');

-- No client INSERT/UPDATE: only the SECURITY DEFINER engine writes grants.


-- ── 4. game_settings: badge image validation config (Req. 2.7) ─

ALTER TABLE game_settings
  ADD COLUMN IF NOT EXISTS badge_image_max_bytes      INTEGER NOT NULL DEFAULT 2097152 CHECK (badge_image_max_bytes > 0),
  ADD COLUMN IF NOT EXISTS badge_image_recommended_px INTEGER NOT NULL DEFAULT 512 CHECK (badge_image_recommended_px > 0);


-- ── 5. award_badge (idempotent grant helper) ──────────────────
-- Inserts a grant if the user does not already own the badge. Returns
-- true if a new grant was created, false if it already existed.
CREATE OR REPLACE FUNCTION award_badge(
  p_tenant     TEXT,
  p_user_id    UUID,
  p_badge_id   UUID,
  p_method     game_badge_grant_method,
  p_granted_by UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted BIGINT := 0;
BEGIN
  INSERT INTO user_badges (tenant, user_id, badge_id, granted_by, grant_method)
  VALUES (p_tenant, p_user_id, p_badge_id, p_granted_by, p_method)
  ON CONFLICT (tenant, user_id, badge_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$;

REVOKE ALL ON FUNCTION award_badge(TEXT, UUID, UUID, game_badge_grant_method, UUID) FROM PUBLIC;


-- ── Internal helper: does the user satisfy a badge criteria? ───
-- Evaluates a criteria JSONB against already-recorded data for a user.
-- Used by both live evaluators and backfill. Unknown types => false.
CREATE OR REPLACE FUNCTION badge_criteria_met(
  p_tenant   TEXT,
  p_user_id  UUID,
  p_criteria JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type    TEXT := p_criteria ->> 'type';
  v_count   INTEGER;
  v_target  INTEGER;
  v_subject UUID;
  v_category UUID;
  v_score   INTEGER;
  v_max     INTEGER;
  v_days    INTEGER;
  v_streak  INTEGER;
BEGIN
  IF v_type IS NULL THEN
    RETURN false;
  END IF;

  IF v_type = 'streak_reached' THEN
    v_days := NULLIF(p_criteria ->> 'days', '')::int;
    IF v_days IS NULL THEN RETURN false; END IF;
    SELECT GREATEST(COALESCE(current_streak, 0), COALESCE(longest_streak, 0))
    INTO v_streak
    FROM game_profiles WHERE tenant = p_tenant AND user_id = p_user_id;
    RETURN COALESCE(v_streak, 0) >= v_days;

  ELSIF v_type = 'quiz_completed_count' THEN
    v_target := NULLIF(p_criteria ->> 'count', '')::int;
    IF v_target IS NULL THEN RETURN false; END IF;
    v_subject := NULLIF(p_criteria ->> 'subject', '')::uuid;
    v_category := NULLIF(p_criteria ->> 'category', '')::uuid;
    SELECT count(*) INTO v_count
    FROM game_point_events e
    WHERE e.tenant = p_tenant AND e.user_id = p_user_id
      AND e.action_type = 'quiz_completed'
      AND (v_subject IS NULL OR e.subject_id = v_subject)
      AND (v_category IS NULL OR e.category_id = v_category);
    RETURN COALESCE(v_count, 0) >= v_target;

  ELSIF v_type = 'weekly_case_count' THEN
    v_target := NULLIF(p_criteria ->> 'count', '')::int;
    IF v_target IS NULL THEN RETURN false; END IF;
    SELECT count(*) INTO v_count
    FROM game_point_events e
    WHERE e.tenant = p_tenant AND e.user_id = p_user_id
      AND e.action_type = 'weekly_case_participated';
    RETURN COALESCE(v_count, 0) >= v_target;

  ELSIF v_type = 'interrogacion_count' THEN
    v_target := NULLIF(p_criteria ->> 'count', '')::int;
    IF v_target IS NULL THEN RETURN false; END IF;
    SELECT count(*) INTO v_count
    FROM game_point_events e
    WHERE e.tenant = p_tenant AND e.user_id = p_user_id
      AND e.action_type = 'interrogacion_completed';
    RETURN COALESCE(v_count, 0) >= v_target;

  ELSIF v_type = 'subject_max_score' THEN
    v_subject := NULLIF(p_criteria ->> 'subject', '')::uuid;
    v_score := NULLIF(p_criteria ->> 'score', '')::int;
    IF v_subject IS NULL OR v_score IS NULL THEN RETURN false; END IF;
    SELECT COALESCE(max(points_awarded), 0) INTO v_max
    FROM game_point_events e
    WHERE e.tenant = p_tenant AND e.user_id = p_user_id
      AND e.subject_id = v_subject;
    RETURN COALESCE(v_max, 0) >= v_score;

  ELSIF v_type = 'challenges_completed' THEN
    v_target := NULLIF(p_criteria ->> 'count', '')::int;
    IF v_target IS NULL THEN RETURN false; END IF;
    SELECT count(*) INTO v_count
    FROM game_challenge_progress cp
    WHERE cp.tenant = p_tenant AND cp.user_id = p_user_id
      AND cp.completed_at IS NOT NULL;
    RETURN COALESCE(v_count, 0) >= v_target;
  END IF;

  RETURN false;  -- unknown type never grants
END;
$$;

REVOKE ALL ON FUNCTION badge_criteria_met(TEXT, UUID, JSONB) FROM PUBLIC;


-- ── Internal helper: evaluate all automatic badges for a user ──
-- Given the user's role, evaluates every enabled automatic badge whose
-- audience includes the role and whose criteria type is in p_types (or all
-- types when p_types is NULL), granting the ones the user now satisfies.
CREATE OR REPLACE FUNCTION evaluate_badges_for_user(
  p_tenant  TEXT,
  p_user_id UUID,
  p_types   TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol   TEXT;
  v_badge game_badges%ROWTYPE;
BEGIN
  -- Resolve the user's role. get_current_user_rol() reflects auth.uid();
  -- for backfill/other users we resolve from profiles directly.
  IF p_user_id = auth.uid() THEN
    v_rol := get_current_user_rol();
  ELSE
    SELECT rol::text INTO v_rol FROM profiles WHERE id = p_user_id;
  END IF;

  IF v_rol IS NULL THEN
    RETURN;
  END IF;

  FOR v_badge IN
    SELECT * FROM game_badges b
    WHERE b.tenant = p_tenant
      AND b.unlock_type = 'automatic'
      AND b.enabled = true
      AND b.deleted_at IS NULL
      AND b.criteria IS NOT NULL
      AND (v_rol = ANY (b.audience))
      AND (p_types IS NULL OR (b.criteria ->> 'type') = ANY (p_types))
  LOOP
    -- Skip if already owned (cheap short-circuit before evaluating).
    IF EXISTS (
      SELECT 1 FROM user_badges
      WHERE tenant = p_tenant AND user_id = p_user_id AND badge_id = v_badge.id
    ) THEN
      CONTINUE;
    END IF;

    IF badge_criteria_met(p_tenant, p_user_id, v_badge.criteria) THEN
      PERFORM award_badge(p_tenant, p_user_id, v_badge.id, 'automatic', NULL);
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION evaluate_badges_for_user(TEXT, UUID, TEXT[]) FROM PUBLIC;


-- ── 6. evaluate_badges_for_event ──────────────────────────────
-- Invoked inside the transaction of a point event. Evaluates automatic
-- badges whose criteria depend on point-event aggregates.
CREATE OR REPLACE FUNCTION evaluate_badges_for_event(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evt game_point_events%ROWTYPE;
BEGIN
  SELECT * INTO v_evt FROM game_point_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM evaluate_badges_for_user(
    v_evt.tenant,
    v_evt.user_id,
    ARRAY['quiz_completed_count', 'subject_max_score', 'weekly_case_count', 'interrogacion_count']
  );
END;
$$;

REVOKE ALL ON FUNCTION evaluate_badges_for_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION evaluate_badges_for_event(UUID) TO authenticated;


-- ── 7. evaluate_badges_for_streak ─────────────────────────────
-- Invoked after apply_streak. Evaluates streak_reached badges.
CREATE OR REPLACE FUNCTION evaluate_badges_for_streak(
  p_tenant  TEXT,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM evaluate_badges_for_user(p_tenant, p_user_id, ARRAY['streak_reached']);
END;
$$;

REVOKE ALL ON FUNCTION evaluate_badges_for_streak(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION evaluate_badges_for_streak(TEXT, UUID) TO authenticated;


-- ── 8. evaluate_badges_for_challenge + trigger ────────────────
CREATE OR REPLACE FUNCTION evaluate_badges_for_challenge(
  p_tenant  TEXT,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM evaluate_badges_for_user(p_tenant, p_user_id, ARRAY['challenges_completed']);
END;
$$;

REVOKE ALL ON FUNCTION evaluate_badges_for_challenge(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION evaluate_badges_for_challenge(TEXT, UUID) TO authenticated;

-- Trigger: when a challenge progress reaches completion (completed_at goes
-- from NULL to a timestamp), evaluate challenge-based badges for that user.
CREATE OR REPLACE FUNCTION tg_game_challenge_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    PERFORM evaluate_badges_for_challenge(NEW.tenant, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER game_challenge_progress_badge_trigger
  AFTER UPDATE ON game_challenge_progress
  FOR EACH ROW
  WHEN (OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL)
  EXECUTE FUNCTION tg_game_challenge_completed();

-- Also fire when a progress row is inserted already completed (edge case).
CREATE OR REPLACE FUNCTION tg_game_challenge_completed_ins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL THEN
    PERFORM evaluate_badges_for_challenge(NEW.tenant, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER game_challenge_progress_badge_trigger_ins
  AFTER INSERT ON game_challenge_progress
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL)
  EXECUTE FUNCTION tg_game_challenge_completed_ins();


-- ── 9. backfill_badge (retroactive grants, Req. 4) ────────────
-- Evaluates a single badge against historical data for every user whose
-- role is in the badge audience, granting to those who already qualify.
CREATE OR REPLACE FUNCTION backfill_badge(
  p_tenant   TEXT,
  p_badge_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge   game_badges%ROWTYPE;
  v_user    RECORD;
  v_granted INTEGER := 0;
BEGIN
  SELECT * INTO v_badge FROM game_badges
  WHERE id = p_badge_id AND tenant = p_tenant;

  IF NOT FOUND OR v_badge.unlock_type <> 'automatic'
     OR NOT v_badge.enabled OR v_badge.deleted_at IS NOT NULL
     OR v_badge.criteria IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_user IN
    SELECT p.id
    FROM profiles p
    WHERE p.rol::text = ANY (v_badge.audience)
  LOOP
    IF EXISTS (
      SELECT 1 FROM user_badges
      WHERE tenant = p_tenant AND user_id = v_user.id AND badge_id = p_badge_id
    ) THEN
      CONTINUE;
    END IF;

    IF badge_criteria_met(p_tenant, v_user.id, v_badge.criteria) THEN
      IF award_badge(p_tenant, v_user.id, p_badge_id, 'automatic', NULL) THEN
        v_granted := v_granted + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_granted;
END;
$$;

REVOKE ALL ON FUNCTION backfill_badge(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION backfill_badge(TEXT, UUID) TO authenticated;


-- ── 10. grant_badge_manual (admin, Req. 5) ────────────────────
CREATE OR REPLACE FUNCTION grant_badge_manual(
  p_tenant   TEXT,
  p_badge_id UUID,
  p_user_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
  v_new    BOOLEAN;
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM game_badges
    WHERE id = p_badge_id AND tenant = p_tenant AND deleted_at IS NULL
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'BADGE_NOT_FOUND');
  END IF;

  v_new := award_badge(p_tenant, p_user_id, p_badge_id, 'manual', auth.uid());

  IF NOT v_new THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ALREADY_OWNED');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION grant_badge_manual(TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grant_badge_manual(TEXT, UUID, UUID) TO authenticated;


-- ── 11. delete_badge (safe delete, Req. 8) ────────────────────
-- If no grants exist: hard-delete (Req. 8.3). If grants exist and p_force
-- is false: return affected_count without deleting (Req. 8.1). If grants
-- exist and p_force is true: soft-delete keeping user_badges (Req. 8.2).
CREATE OR REPLACE FUNCTION delete_badge(
  p_tenant   TEXT,
  p_badge_id UUID,
  p_force    BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected INTEGER;
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM game_badges WHERE id = p_badge_id AND tenant = p_tenant) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'BADGE_NOT_FOUND');
  END IF;

  SELECT count(*) INTO v_affected
  FROM user_badges WHERE tenant = p_tenant AND badge_id = p_badge_id;

  IF v_affected = 0 THEN
    DELETE FROM game_badges WHERE id = p_badge_id AND tenant = p_tenant;
    RETURN jsonb_build_object('ok', true, 'deleted', 'hard', 'affected_count', 0);
  END IF;

  IF NOT p_force THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'HAS_GRANTS', 'affected_count', v_affected);
  END IF;

  -- Soft-delete: keep trace of prior grants (Req. 8.2).
  UPDATE game_badges
  SET enabled = false, deleted_at = now()
  WHERE id = p_badge_id AND tenant = p_tenant;

  RETURN jsonb_build_object('ok', true, 'deleted', 'soft', 'affected_count', v_affected);
END;
$$;

REVOKE ALL ON FUNCTION delete_badge(TEXT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_badge(TEXT, UUID, BOOLEAN) TO authenticated;


-- ── 12. get_user_badges (player showcase, Req. 7) ─────────────
CREATE OR REPLACE FUNCTION get_user_badges(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_rol      TEXT := get_current_user_rol();
  v_unlocked JSONB;
  v_locked   JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Unlocked: badges the user owns (Req. 7.1).
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'description', b.description,
      'image_path', b.image_path,
      'series_key', b.series_key,
      'series_order', b.series_order,
      'granted_at', ub.granted_at,
      'grant_method', ub.grant_method
    ) ORDER BY b.series_key NULLS LAST, b.series_order NULLS LAST, ub.granted_at
  ), '[]'::jsonb)
  INTO v_unlocked
  FROM user_badges ub
  JOIN game_badges b ON b.id = ub.badge_id
  WHERE ub.tenant = p_tenant AND ub.user_id = v_user_id;

  -- Locked: enabled, non-deleted badges for the user's audience not owned yet
  -- (Req. 7.2). criteria is omitted when hide_criteria is true (Req. 7.4/7.5).
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'description', b.description,
      'image_path', b.image_path,
      'series_key', b.series_key,
      'series_order', b.series_order,
      'criteria', CASE WHEN b.hide_criteria THEN NULL ELSE b.criteria END,
      'hide_criteria', b.hide_criteria
    ) ORDER BY b.series_key NULLS LAST, b.series_order NULLS LAST, b.name
  ), '[]'::jsonb)
  INTO v_locked
  FROM game_badges b
  WHERE b.tenant = p_tenant
    AND b.enabled = true
    AND b.deleted_at IS NULL
    AND (v_rol = ANY (b.audience))
    AND NOT EXISTS (
      SELECT 1 FROM user_badges ub
      WHERE ub.tenant = p_tenant AND ub.user_id = v_user_id AND ub.badge_id = b.id
    );

  RETURN jsonb_build_object('unlocked', v_unlocked, 'locked', v_locked);
END;
$$;

REVOKE ALL ON FUNCTION get_user_badges(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_badges(TEXT) TO authenticated;


-- ── 13. Rewire submit_quiz (evaluate badges after event + streak) ──
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
    -- Streak-based badges (Req. 3.4).
    PERFORM evaluate_badges_for_streak(p_tenant, v_user_id);
  END IF;

  -- Evaluate challenges within the same transaction (Req. 10.4).
  v_completed := evaluate_challenges_for_event(v_event_id);

  -- Evaluate event-based badges within the same transaction (Req. 3.2).
  PERFORM evaluate_badges_for_event(v_event_id);

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


-- ── 13b. Rewire answer_daily_question (evaluate streak badges) ─
-- Only the streak-badge hook is added; all other behavior is identical to
-- migration 122.
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

  IF v_counts_streak THEN
    SELECT o_current, o_longest INTO v_new_current, v_new_longest
    FROM apply_streak(p_tenant, v_user_id, v_today);
    -- Streak-based badges (Req. 3.4).
    PERFORM evaluate_badges_for_streak(p_tenant, v_user_id);
  ELSE
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


-- ── 14. Storage bucket for badge images ───────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-badges', 'game-badges', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (bucket is public); writes restricted to service role only.
-- Deletion/insertion happen via the admin API using createAdminClient(),
-- which bypasses RLS, so no authenticated write policy is defined.
CREATE POLICY "game_badges_images_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'game-badges');
