-- Migration 087: Split overly-broad FOR ALL admin policy on invitations
-- ─────────────────────────────────────────────────────────────────────────────
-- The "Admins can manage invitations" policy used FOR ALL which combines
-- read+write in one predicate without explicit WITH CHECK, flagged as a
-- security risk by react-doctor/supabase-rls-policy-risk.
--
-- Fix: replace with explicit per-operation policies with proper WITH CHECK
-- clauses on write operations.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the overly-broad FOR ALL policy
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.invitations;

-- Explicit SELECT policy for admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations'
      AND policyname = 'Admins can read invitations'
  ) THEN
    CREATE POLICY "Admins can read invitations"
      ON public.invitations FOR SELECT
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

-- Explicit INSERT policy for admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations'
      AND policyname = 'Admins can insert invitations'
  ) THEN
    CREATE POLICY "Admins can insert invitations"
      ON public.invitations FOR INSERT
      WITH CHECK ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

-- Explicit UPDATE policy for admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations'
      AND policyname = 'Admins can update invitations'
  ) THEN
    CREATE POLICY "Admins can update invitations"
      ON public.invitations FOR UPDATE
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin')
      WITH CHECK ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

-- Explicit DELETE policy for admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations'
      AND policyname = 'Admins can delete invitations'
  ) THEN
    CREATE POLICY "Admins can delete invitations"
      ON public.invitations FOR DELETE
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;
