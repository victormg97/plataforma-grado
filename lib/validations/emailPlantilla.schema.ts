import { z } from 'zod';

/**
 * Tipos de correo soportados que un Usuario_Editor puede personalizar.
 * Subconjunto de `tipo_notificacion` (ver lib/email/types.ts → TipoCorreo).
 * Se exporta para reutilizar en la validación del parámetro `tipo` de las rutas.
 */
export const TIPOS_CORREO = [
  'confirmacion',
  'cancelacion',
  'solicitud_cambio_horario',
  'programa_asignado',
  'nueva_clase',
  'invitacion_acceso',
  'bienvenida_registro',
  'nueva_nota_clase',
  'recordatorio_clase',
  'nueva_simulacion',
] as const;

/** Enum Zod para validar el parámetro `tipo` de las rutas del editor de plantillas. */
export const tipoCorreoSchema = z.enum(TIPOS_CORREO, {
  error: 'Tipo de correo no válido',
});

/** Tipo inferido del conjunto de tipos de correo soportados. */
export type TipoCorreo = (typeof TIPOS_CORREO)[number];

/**
 * Esquema de validación para la edición de una plantilla de correo (Requisito 7.6).
 * - `asunto`: requerido, no vacío tras trim, entre 1 y 200 caracteres.
 * - `cuerpo_html`: requerido, no vacío tras trim.
 * - `max_caracteres_nota`: opcional, solo para tipo `nueva_nota_clase`.
 *   - null/undefined: usar default del sistema (600 caracteres).
 *   - 0: mostrar la nota completa sin truncar.
 *   - número > 0: truncar al indicar ese número de caracteres.
 * El uso de `.trim()` garantiza el rechazo de cadenas compuestas solo por espacios.
 */
export const emailPlantillaSchema = z.object({
  asunto: z
    .string({ error: 'El asunto es requerido' })
    .trim()
    .min(1, 'El asunto es requerido')
    .max(200, 'El asunto no puede superar los 200 caracteres'),
  cuerpo_html: z
    .string({ error: 'El cuerpo del correo es requerido' })
    .trim()
    .min(1, 'El cuerpo del correo es requerido'),
  max_caracteres_nota: z
    .number()
    .int()
    .min(0, 'El valor debe ser 0 o mayor')
    .nullable()
    .optional(),
});

/** Tipo inferido de los datos validados de una plantilla de correo. */
export type EmailPlantillaInput = z.infer<typeof emailPlantillaSchema>;
