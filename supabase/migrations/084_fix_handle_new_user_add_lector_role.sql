-- ── 084: Fix handle_new_user trigger to support 'lector' role ──────────────
-- Previously the trigger only checked for 'admin' and 'profesor', defaulting
-- everything else (including 'lector') to 'alumno'. This caused users
-- registering via lector invitation links to get the wrong role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_rol_final user_rol;
BEGIN
  v_rol := new.raw_user_meta_data->>'rol';
  
  IF v_rol = 'admin' THEN
    v_rol_final := 'admin'::user_rol;
  ELSIF v_rol = 'profesor' THEN
    v_rol_final := 'profesor'::user_rol;
  ELSIF v_rol = 'lector' THEN
    v_rol_final := 'lector'::user_rol;
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
