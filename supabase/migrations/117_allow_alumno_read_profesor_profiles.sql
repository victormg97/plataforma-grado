-- Allow alumnos to read professor and admin profiles (needed for displaying
-- comisión evaluadora names/avatars in simulación class detail views)
CREATE POLICY "Alumno ve profesores y admins"
  ON profiles
  FOR SELECT
  USING (
    get_user_rol() = 'alumno'::user_rol
    AND rol IN ('profesor'::user_rol, 'admin'::user_rol)
  );
