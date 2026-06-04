-- ── 080: Tabla para que admins descarten notificaciones de su vista ──────────
-- El campo `leida` de `notificaciones` pertenece al destinatario original.
-- Para admins, borrar una notificación no debe afectar al destinatario real.
-- La tabla `notificaciones_vistas_admin` ya maneja el estado de lectura;
-- esta tabla maneja el descarte (ocultar de la vista del admin).
--
-- Cuando un admin "elimina" una notificación:
--   1. Se inserta una fila aquí con (notificacion_id, admin_id).
--   2. El GET filtra estas filas → la notificación desaparece para ese admin.
--   3. La notificación original sigue intacta para el destinatario real.
--   4. Otros admins NO son afectados — cada uno gestiona su propio descarte.

CREATE TABLE IF NOT EXISTS public.notificaciones_descartadas_admin (
  notificacion_id  uuid NOT NULL REFERENCES public.notificaciones(id) ON DELETE CASCADE,
  admin_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notificacion_id, admin_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_descartadas_admin_id
  ON public.notificaciones_descartadas_admin (admin_id);

ALTER TABLE public.notificaciones_descartadas_admin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_ve_sus_descartadas"
  ON public.notificaciones_descartadas_admin FOR SELECT TO authenticated
  USING (admin_id = auth.uid());

CREATE POLICY "admin_inserta_sus_descartadas"
  ON public.notificaciones_descartadas_admin FOR INSERT TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "admin_borra_sus_descartadas"
  ON public.notificaciones_descartadas_admin FOR DELETE TO authenticated
  USING (admin_id = auth.uid());
