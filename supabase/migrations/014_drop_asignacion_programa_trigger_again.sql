-- Drop the trigger and function re-created by migration 013.
-- Notification creation is handled in the API route (asignar/route.ts) using
-- the authenticated client so that Supabase Realtime fires correctly.
-- DB trigger approach (SECURITY DEFINER) bypasses Realtime channel auth.
SET client_min_messages TO 'warning';
DROP TRIGGER IF EXISTS asignacion_programa_on_insert ON public.asignaciones_programa;
DROP FUNCTION IF EXISTS create_notification_on_asignacion_programa();
SET client_min_messages TO 'notice';
