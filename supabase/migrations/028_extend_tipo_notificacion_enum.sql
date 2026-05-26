-- Extend tipo_notificacion enum with schedule change request notification types
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'solicitud_cambio_horario';
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'cambio_horario_aceptado';
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'cambio_horario_rechazado';
