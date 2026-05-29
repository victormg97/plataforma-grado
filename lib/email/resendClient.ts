import { Resend } from 'resend';

/**
 * Cliente Resend con inicialización perezosa (solo-servidor).
 *
 * Este módulo encapsula el acceso al proveedor de correo Resend. La clave de API
 * se lee EXCLUSIVAMENTE desde la variable de entorno `RESEND_API_KEY` mediante
 * `process.env`, sin prefijo `NEXT_PUBLIC_` y sin valores literales en el código
 * fuente (Requisitos 1.1, 1.2, 1.4). El cliente solo se construye cuando existe
 * una clave válida, siguiendo el patrón de degradación silenciosa de
 * `lib/utils/rateLimit.ts` (Requisito 1.5).
 *
 * IMPORTANTE: archivo solo-servidor. No debe importarse en componentes de cliente;
 * `RESEND_API_KEY` nunca se expone al navegador.
 */

// Singleton perezoso a nivel de módulo: el cliente se cachea tras la primera construcción.
let resend: Resend | null = null;

/**
 * Lee y normaliza la clave de API de Resend.
 *
 * Devuelve la clave si, tras `trim()`, tiene longitud mayor que cero; devuelve
 * `null` cuando la variable está ausente, es una cadena vacía o contiene
 * únicamente espacios en blanco (Requisito 1.5). La clave proviene solo de
 * `process.env.RESEND_API_KEY` (Requisitos 1.1, 1.2, 1.4).
 */
function getApiKey(): string | null {
  const raw = process.env.RESEND_API_KEY;
  if (!raw) return null;
  const key = raw.trim(); // Requisito 1.5: vacío o solo espacios → null
  return key.length > 0 ? key : null;
}

/**
 * Indica si el envío de correo está habilitado para el tenant activo.
 *
 * Devuelve `true` cuando hay una clave válida configurada y `false` en caso
 * contrario, sin depender de ningún identificador de tenant codificado
 * (Requisitos 12.1, 12.2). El backend (`/api/perfil`) la usa para exponer el
 * flag `email_disponible` al cliente, y el `emailService` para decidir la
 * degradación silenciosa.
 */
export function isEmailEnabled(): boolean {
  return getApiKey() !== null;
}

/**
 * Devuelve el cliente Resend o `null` si el envío no está habilitado
 * (degradación silenciosa, Requisito 1.5).
 *
 * Cuando hay clave válida, construye el cliente de forma perezosa la primera vez
 * y lo cachea en el singleton de módulo para reutilizarlo en llamadas sucesivas.
 */
export function getResendClient(): Resend | null {
  if (!isEmailEnabled()) return null;
  if (!resend) resend = new Resend(getApiKey()!);
  return resend;
}
