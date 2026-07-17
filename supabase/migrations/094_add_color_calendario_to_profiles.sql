-- 094: Add color_calendario column to profiles
-- Allows professors and admins to choose their own calendar color.
-- Default is NULL, which means the system will use the brand/fallback color.

ALTER TABLE public.profiles
ADD COLUMN color_calendario text DEFAULT NULL;

-- Update the admin prefetch RPC to include color_calendario in profesor data
-- (horarios_calendario already joins profiles as "profesor" — we add the field to the select)
COMMENT ON COLUMN public.profiles.color_calendario IS 'Hex color chosen by professor/admin for calendar display. NULL = use default brand color.';
