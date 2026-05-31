import { z } from 'zod';

// ─── Constantes de contraseña ────────────────────────────────────────────────
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 128;

// ─── Campos por tipo ──────────────────────────────────────────────────────────
// Campos obligatorios y opcionales del registro manual según el tipo de enlace.
// Sirven tanto para marcar con asterisco en el cliente como para validar en el
// servidor.

export const CAMPOS_OBLIGATORIOS = {
  profesor: ['nombre', 'apellido', 'email'] as const,
  alumno: ['nombre', 'apellido', 'email'] as const,
};

export const CAMPOS_OPCIONALES = {
  profesor: ['apellido_materno', 'telefono'] as const,
  alumno: ['apellido_materno', 'telefono', 'universidad', 'año_ingreso'] as const,
};

export type TipoRegistro = 'profesor' | 'alumno';

// ─── Forma de los datos del formulario ────────────────────────────────────────
export interface RegistroFormData {
  nombre: string;
  apellido: string;
  apellido_materno?: string;
  email: string;
  telefono?: string;
  universidad?: string;
  ['año_ingreso']?: string;
  password: string;
  confirmar: string;
  aceptaTyC: boolean;
}

const trimmed = (label: string) =>
  z
    .string({ message: `${label} es obligatorio` })
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, { message: `${label} es obligatorio` });

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(PASSWORD_MAX, `La contraseña no puede superar ${PASSWORD_MAX} caracteres`);

const baseObject = {
  nombre: trimmed('El nombre'),
  apellido: trimmed('El apellido'),
  apellido_materno: z.string().optional(),
  email: z.string().email('Correo electrónico inválido'),
  telefono: z.string().optional(),
  password: passwordSchema,
  confirmar: z.string(),
  aceptaTyC: z.literal(true, { message: 'Debes aceptar los Términos y Condiciones' }),
};

export const registroProfesorSchema = z
  .object(baseObject)
  .refine((d) => d.password === d.confirmar, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmar'],
  });

export const registroAlumnoSchema = z
  .object({
    ...baseObject,
    universidad: z.string().optional(),
    ['año_ingreso']: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmar, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmar'],
  });

export function schemaPorTipo(tipo: TipoRegistro) {
  return tipo === 'profesor' ? registroProfesorSchema : registroAlumnoSchema;
}

// ─── Regla compartida cliente/servidor ────────────────────────────────────────

function noVacio(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Regla compartida de validez del registro, usada para habilitar el botón
 * "Crear cuenta" en el cliente y para aceptar la solicitud en el servidor.
 * Verdadera si y solo si:
 *  - todos los obligatorios del tipo son no vacíos tras recortar espacios,
 *  - la contraseña tiene entre 6 y 128 caracteres,
 *  - la contraseña y su repetición coinciden,
 *  - los Términos y Condiciones están aceptados.
 */
export function registroEsValido(
  form: Partial<RegistroFormData>,
  tipo: TipoRegistro,
): boolean {
  const obligatorios = CAMPOS_OBLIGATORIOS[tipo];
  for (const campo of obligatorios) {
    if (!noVacio((form as Record<string, unknown>)[campo])) return false;
  }

  const password = form.password ?? '';
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return false;
  if (password !== form.confirmar) return false;
  if (form.aceptaTyC !== true) return false;

  return true;
}
