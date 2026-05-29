-- Migration 046: Fix handle_new_user trigger for multi-tenant compatibility
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEMA: La BD de nuevos tenants puede tener la versión antigua del trigger
-- handle_new_user que falla cuando:
--   1. El INSERT en profiles viola alguna constraint (sin ON CONFLICT DO NOTHING)
--   2. El rol no es un valor válido del enum y lanza excepción sin manejo
--   3. Columnas NOT NULL sin default agregadas después del trigger original
--
-- SOLUCIÓN: Reemplazar el trigger con una versión robusta que:
--   - Maneja el enum de forma segura (sin CAST directo que puede fallar)
--   - Usa ON CONFLICT (id) DO NOTHING para ser idempotente
--   - Nunca falla silenciosamente bloqueando el signup de Auth
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_rol text;
  v_rol_final user_rol;
BEGIN
  -- Leer el rol como texto primero
  v_rol := new.raw_user_meta_data->>'rol';
  
  -- Convertir a enum de forma segura, default 'alumno'
  IF v_rol = 'admin' THEN
    v_rol_final := 'admin'::user_rol;
  ELSIF v_rol = 'profesor' THEN
    v_rol_final := 'profesor'::user_rol;
  ELSE
    v_rol_final := 'alumno'::user_rol;
  END IF;

  INSERT INTO public.profiles (id, email, nombre, apellido, rol)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nombre', 'Usuario'),
    COALESCE(new.raw_user_meta_data->>'apellido', ''),
    v_rol_final
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- Asegurar que el trigger existe y apunta a la función actualizada
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- REPARACIÓN: Crear perfiles faltantes para usuarios de Auth que no tienen
-- perfil en public.profiles (puede ocurrir si el trigger falló anteriormente)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, email, nombre, apellido, rol)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'nombre', 'Usuario'),
  COALESCE(au.raw_user_meta_data->>'apellido', ''),
  CASE
    WHEN au.raw_user_meta_data->>'rol' = 'admin'   THEN 'admin'::user_rol
    WHEN au.raw_user_meta_data->>'rol' = 'profesor' THEN 'profesor'::user_rol
    ELSE 'alumno'::user_rol
  END
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;
