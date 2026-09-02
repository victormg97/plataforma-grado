-- ============================================================
-- Migration 129: Comunidad Estratégica (Slice 3) — Seed insignias
-- ============================================================
-- Example badges for the tenant 'pregunta-estrategica' (marked as example
-- data; safe to edit/delete from the admin panel). Audience: alumno.
--   - Streak series (3/7/15/30) aligned to game_streak_thresholds.
--   - "100 preguntas correctas" (quiz completion volume).
-- Idempotent: uses name uniqueness per tenant guard via NOT EXISTS.
-- ============================================================

INSERT INTO game_badges (tenant, name, description, audience, unlock_type, criteria, series_key, series_order, hide_criteria, enabled)
SELECT * FROM (VALUES
  ('pregunta-estrategica', 'Racha de 3 días',  'Mantén una racha de 3 días.',  ARRAY['alumno'], 'automatic'::game_badge_unlock_type, '{"type":"streak_reached","days":3}'::jsonb,  'streak', 1, false, true),
  ('pregunta-estrategica', 'Racha de 7 días',  'Mantén una racha de 7 días.',  ARRAY['alumno'], 'automatic'::game_badge_unlock_type, '{"type":"streak_reached","days":7}'::jsonb,  'streak', 2, false, true),
  ('pregunta-estrategica', 'Racha de 15 días', 'Mantén una racha de 15 días.', ARRAY['alumno'], 'automatic'::game_badge_unlock_type, '{"type":"streak_reached","days":15}'::jsonb, 'streak', 3, false, true),
  ('pregunta-estrategica', 'Racha de 30 días', 'Mantén una racha de 30 días.', ARRAY['alumno'], 'automatic'::game_badge_unlock_type, '{"type":"streak_reached","days":30}'::jsonb, 'streak', 4, false, true),
  ('pregunta-estrategica', '10 cuestionarios', 'Completa 10 cuestionarios.',   ARRAY['alumno'], 'automatic'::game_badge_unlock_type, '{"type":"quiz_completed_count","count":10}'::jsonb, NULL, NULL, false, true)
) AS v(tenant, name, description, audience, unlock_type, criteria, series_key, series_order, hide_criteria, enabled)
WHERE NOT EXISTS (
  SELECT 1 FROM game_badges b WHERE b.tenant = v.tenant AND b.name = v.name
);
