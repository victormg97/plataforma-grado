-- ── 075: Agregar valor 'lector' al enum user_rol ──────────────────────────
-- Los valores de enum en PostgreSQL necesitan ser commiteados antes de usarse
-- en políticas RLS o comparaciones, por eso se hace en migración separada.
ALTER TYPE public.user_rol ADD VALUE IF NOT EXISTS 'lector';
