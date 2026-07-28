-- ─────────────────────────────────────────────────────────────────────────────
-- 098: Añade columna max_caracteres_nota a email_plantillas
-- ─────────────────────────────────────────────────────────────────────────────
-- Permite configurar, por plantilla personalizada del tipo 'nueva_nota_clase',
-- cuántos caracteres de la nota se muestran en el correo antes de truncar.
-- NULL = usar el valor por defecto del sistema (600 caracteres).
-- 0 = mostrar la nota completa sin truncar.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.email_plantillas
  ADD COLUMN IF NOT EXISTS max_caracteres_nota integer DEFAULT NULL;

COMMENT ON COLUMN public.email_plantillas.max_caracteres_nota IS
  'Máx. caracteres de la nota mostrados en el correo (NULL=default 600, 0=completa)';
