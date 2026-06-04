-- Agrega el valor 'bienvenida_registro' al enum tipo_notificacion.
--
-- Se usa para el correo de bienvenida que se envía cuando un usuario
-- completa su propio registro mediante un enlace de invitación (/api/registro).
-- A diferencia de 'invitacion_acceso' (flujo admin/profesor → setup de contraseña),
-- este tipo corresponde a un usuario que ya eligió su contraseña y tiene sesión
-- activa, por lo que el correo es solo de bienvenida, sin acciones pendientes.

ALTER TYPE tipo_notificacion ADD VALUE IF NOT EXISTS 'bienvenida_registro';
