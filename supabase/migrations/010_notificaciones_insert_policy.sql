-- Allow any authenticated user to INSERT notifications for any recipient.
-- The existing ALL policies restrict SELECT/UPDATE/DELETE to own notifications,
-- but prevented professors/admins from inserting notifications for students.
-- API routes already enforce role-based authorization, so this is safe.
CREATE POLICY "Autenticado puede insertar notificaciones"
  ON public.notificaciones
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
