-- ─────────────────────────────────────────────────────────────────
-- 067: Estado de lectura independiente para admins en notificaciones
-- ─────────────────────────────────────────────────────────────────
-- Problema: la tabla `notificaciones` tiene un único campo `leida`
-- ligado al registro. Los admins ven notificaciones cuyo
-- destinatario_id es un profesor/alumno, por lo que al intentar
-- marcarlas como leídas el PATCH falla (el WHERE destinatario_id
-- no coincide con el admin). Aunque la policy de admin les permite
-- actualizar cualquier fila, el campo `leida` se compartiría con
-- el destinatario original. La solución es una tabla de junction
-- que registra qué admins ya vieron qué notificación.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notificaciones_vistas_admin (
  notificacion_id  uuid NOT NULL REFERENCES public.notificaciones(id) ON DELETE CASCADE,
  admin_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notificacion_id, admin_id)
);

-- Índice para búsquedas por admin_id
CREATE INDEX IF NOT EXISTS idx_notif_vistas_admin_admin_id
  ON public.notificaciones_vistas_admin (admin_id);

-- RLS
ALTER TABLE public.notificaciones_vistas_admin ENABLE ROW LEVEL SECURITY;

-- Solo el admin dueño del registro puede ver/insertar/borrar sus propias vistas
CREATE POLICY "admin_ve_sus_vistas" ON public.notificaciones_vistas_admin
  FOR SELECT TO authenticated
  USING (admin_id = auth.uid());

CREATE POLICY "admin_inserta_sus_vistas" ON public.notificaciones_vistas_admin
  FOR INSERT TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND (SELECT get_user_rol()) = 'admin'
  );

CREATE POLICY "admin_borra_sus_vistas" ON public.notificaciones_vistas_admin
  FOR DELETE TO authenticated
  USING (admin_id = auth.uid());

-- Exponer la tabla a Realtime (para que el badge se actualice en tiempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones_vistas_admin;
