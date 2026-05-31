-- ============================================================
-- 063_user_ui_preferences.sql
-- General-purpose per-user UI preferences.
--
-- Stores lightweight client display state (e.g. which dashboard
-- accordions are open/closed) in a single JSONB column so new UI
-- toggles can be added WITHOUT a schema migration each time.
--
-- Kept separate from `tema` / `idioma`, which stay as scalar columns
-- because they have server-side / cross-cutting uses (i18n cookie,
-- email language, theme SSR).
-- ============================================================

-- 1. JSONB column on profiles (defaults to empty object, never NULL)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Merge-update a single UI preference key for the CURRENT user.
--    Using the jsonb `||` operator merges instead of replacing, so saving
--    one key never clobbers others when several settings persist concurrently.
--    SECURITY INVOKER -> the existing "Usuario actualiza su propio perfil"
--    RLS policy applies, so a user can only ever touch their own row.
CREATE OR REPLACE FUNCTION public.set_ui_preference(p_key text, p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_key IS NULL OR length(p_key) = 0 THEN
    RAISE EXCEPTION 'p_key requerido';
  END IF;

  UPDATE public.profiles
     SET ui_preferences = coalesce(ui_preferences, '{}'::jsonb) || jsonb_build_object(p_key, p_value),
         updated_at = now()
   WHERE id = auth.uid()
  RETURNING ui_preferences INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_ui_preference(text, jsonb) TO authenticated;
