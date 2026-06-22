-- ── 091: Create get_lectores_admin RPC with last_sign_in_at ─────────────────────
-- Replaces the direct profiles query so we can JOIN with auth.users
-- to include last_sign_in_at for admin view.

CREATE OR REPLACE FUNCTION public.get_lectores_admin()
RETURNS TABLE(
  id uuid,
  nombre text,
  apellido text,
  apellido_materno text,
  email text,
  telefono text,
  avatar_url text,
  activo boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    p.id, p.nombre, p.apellido, p.apellido_materno,
    p.email, p.telefono, p.avatar_url, p.activo,
    p.created_at,
    au.last_sign_in_at
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE p.rol = 'lector'
  ORDER BY p.nombre;
$function$;
