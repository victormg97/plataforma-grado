/**
 * Slice `ocultacion` — esquemas de validación (Requisitos 9.1, 9.4).
 *
 * Un único esquema: el identificador del evento que se desea ocultar o mostrar.
 * La misma forma sirve para ambas operaciones.
 *
 * Dependencias: `zod`. Nada del proyecto (nivel 2 del grafo).
 */
import { z } from 'zod';

/** Esquema de entrada para ocultar o mostrar una Actividad. */
export const ocultarActividadSchema = z.object({
  eventoId: z.string().uuid(),
});

/** Tipo inferido del esquema. */
export type OcultarActividad = z.infer<typeof ocultarActividadSchema>;
