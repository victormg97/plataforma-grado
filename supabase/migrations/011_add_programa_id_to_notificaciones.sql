-- Add programa_id to notificaciones table
ALTER TABLE public.notificaciones 
ADD COLUMN programa_id uuid REFERENCES public.programas_clases(id) ON DELETE SET NULL;
