-- 054_invitacion_acceso_enum.sql
-- Añade 'invitacion_acceso' al enum tipo_notificacion (Requisito 19.9).
-- ALTER TYPE ... ADD VALUE no puede usarse en la misma transacción que use el valor;
-- esta migración solo hace el ADD VALUE (idempotente con IF NOT EXISTS).
ALTER TYPE tipo_notificacion ADD VALUE IF NOT EXISTS 'invitacion_acceso';
