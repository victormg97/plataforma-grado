-- Add cancellation_deadline_hours to profiles
-- Idempotent: IF NOT EXISTS guard on column, DROP/ADD on constraint
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cancellation_deadline_hours INTEGER NOT NULL DEFAULT 0;

-- Re-apply constraint idempotently (drop first in case it exists without the check)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cancellation_deadline_hours_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cancellation_deadline_hours_check
    CHECK (cancellation_deadline_hours >= 0);
