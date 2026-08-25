-- Add nueva_simulacion to tipo_notificacion enum
ALTER TYPE public.tipo_notificacion ADD VALUE IF NOT EXISTS 'nueva_simulacion';
