import { z } from 'zod';

export const alumnoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  apellido: z.string().min(1, 'El apellido es requerido'),
  email: z.string().email('Correo electrónico inválido'),
  telefono: z.string().optional(),
  universidad: z.string().optional(),
  año_ingreso: z.string().optional(),
  notas: z.string().optional(),
});

export type AlumnoFormData = z.infer<typeof alumnoSchema>;
