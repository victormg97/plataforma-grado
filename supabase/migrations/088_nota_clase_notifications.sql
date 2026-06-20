-- ── 088: Notifications for class notes ──────────────────────────────────────
-- When a note is created on a class, the other participants should be notified.
-- This migration:
--   1. Adds 'nueva_nota_clase' to the tipo_notificacion enum
--   2. Adds nota_clase_id FK column to notificaciones
--   3. Adds notas_clase to the supabase_realtime publication
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend enum
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'nueva_nota_clase';

-- 2. Add nota_clase_id column
ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS nota_clase_id uuid REFERENCES public.notas_clase(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notificaciones_nota_clase_id ON public.notificaciones(nota_clase_id);

-- 3. Add notas_clase to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notas_clase'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notas_clase;
  END IF;
END $$;

ALTER TABLE public.notas_clase REPLICA IDENTITY FULL;
