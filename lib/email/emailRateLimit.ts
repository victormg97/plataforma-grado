import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { RateLimitResult } from '@/lib/utils/rateLimit';

/**
 * Limitador_Tasa_Correo (Requisito 16).
 *
 * Reutiliza el patrón de inicialización perezosa de `lib/utils/rateLimit.ts`:
 * el cliente Redis y los limiters solo se construyen si las variables de entorno
 * `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` están configuradas y la
 * URL empieza con `https://`. En caso contrario, los limiters quedan en `null` y
 * las funciones degradan a no-op devolviendo `allowed: true`, de forma consistente
 * con la infraestructura de limitación existente (Requisito 16.5).
 *
 * Se usan dos ventanas deslizantes independientes con prefijo `rl:email`:
 * - originador: límite por usuario que origina la notificación (Requisito 16.2).
 * - destinatario: límite por correo de destinatario (Requisito 16.3).
 *
 * Las claves usan prefijos distintos (`orig:` / `dest:`) para aislar los conteos
 * entre usuarios originadores y destinatarios (Requisito 16.6).
 */

// ── Upstash Redis client ─────────────────────────────────────────────────────
// Degrada a no-op cuando las variables de entorno no están configuradas
// (p. ej. desarrollo local sin Redis), igual que lib/utils/rateLimit.ts.
let redis: Redis | null = null;
let originadorLimiter: Ratelimit | null = null;
let destinatarioLimiter: Ratelimit | null = null;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/^["']|["']$/g, '');
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.replace(/^["']|["']$/g, '');

if (redisUrl && redisToken && redisUrl.startsWith('https://')) {
  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  // Originador: 20 correos por hora por usuario que origina la notificación.
  originadorLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: false,
    prefix: 'rl:email',
  });

  // Destinatario: 10 correos por hora por dirección de destino.
  destinatarioLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: false,
    prefix: 'rl:email',
  });
}

// ── Límite por usuario originador (Requisito 16.2) ───────────────────────────
/**
 * Evalúa el límite de tasa de correos para un usuario originador.
 * Clave: `orig:{originadorId}` (Requisito 16.6).
 *
 * @param originadorId Identificador del usuario que origina la notificación.
 * @returns Resultado del límite; sin Redis configurado degrada a no-op
 *   (`allowed: true`, Requisito 16.5).
 */
export async function checkEmailRateLimitOriginador(
  originadorId: string,
): Promise<RateLimitResult> {
  if (!originadorLimiter) {
    // Redis no configurado — permitir todo (Requisito 16.5)
    return { allowed: true, remaining: 20, retryAfterSeconds: 0 };
  }

  const result = await originadorLimiter.limit(`orig:${originadorId}`);

  return {
    allowed: result.success,
    remaining: result.remaining,
    retryAfterSeconds: result.success
      ? 0
      : Math.ceil((result.reset - Date.now()) / 1000),
  };
}

// ── Límite por destinatario (Requisito 16.3) ─────────────────────────────────
/**
 * Evalúa el límite de tasa de correos para un correo de destinatario.
 * El correo se normaliza a minúsculas y se le aplica `trim()` para evitar
 * elusiones triviales del conteo. Clave: `dest:{emailNormalizado}` (Requisito 16.6).
 *
 * @param email Correo del destinatario.
 * @returns Resultado del límite; sin Redis configurado degrada a no-op
 *   (`allowed: true`, Requisito 16.5).
 */
export async function checkEmailRateLimitDestinatario(
  email: string,
): Promise<RateLimitResult> {
  if (!destinatarioLimiter) {
    // Redis no configurado — permitir todo (Requisito 16.5)
    return { allowed: true, remaining: 10, retryAfterSeconds: 0 };
  }

  const emailNormalizado = email.toLowerCase().trim();
  const result = await destinatarioLimiter.limit(`dest:${emailNormalizado}`);

  return {
    allowed: result.success,
    remaining: result.remaining,
    retryAfterSeconds: result.success
      ? 0
      : Math.ceil((result.reset - Date.now()) / 1000),
  };
}
