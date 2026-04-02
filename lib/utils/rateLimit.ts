import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── Upstash Redis client ─────────────────────────────────────────────────────
// Falls back to a no-op limiter when env vars are not set (local dev without Redis).
let redis: Redis | null = null;
let loginLimiter: Ratelimit | null = null;
let apiLimiter: Ratelimit | null = null;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/^["']|["']$/g, '');
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.replace(/^["']|["']$/g, '');

if (redisUrl && redisToken && redisUrl.startsWith('https://')) {
  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  // Login: strict — 5 attempts per 15 minutes per IP+email combination
  loginLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: false,
    prefix: 'rl:login',
  });

  // General API: 100 requests per minute per IP
  apiLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: false,
    prefix: 'rl:api',
  });
}

// ── IP extraction ────────────────────────────────────────────────────────────
export function getIp(request: NextRequest): string {
  // Vercel populates x-forwarded-for; fallback for local dev
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // May be comma-separated list; take the first (client) IP
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  // Next.js 15+ exposes ip on the request object
  const ip = (request as NextRequest & { ip?: string }).ip;
  if (ip) return ip;
  return 'unknown';
}

// ── Rate limit check result ──────────────────────────────────────────────────
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// ── Login rate limiter ───────────────────────────────────────────────────────
// Key: IP + email so a single attacker is blocked even with multiple IPs, and
// legitimate users on shared IPs are not penalised for unrelated attempts.
export async function checkLoginRateLimit(
  ip: string,
  email: string,
): Promise<RateLimitResult> {
  if (!loginLimiter) {
    // Redis not configured — allow all (local dev)
    return { allowed: true, remaining: 5, retryAfterSeconds: 0 };
  }

  // Normalise email to lowercase to prevent trivial bypass
  const key = `${ip}:${email.toLowerCase().trim()}`;
  const result = await loginLimiter.limit(key);

  return {
    allowed: result.success,
    remaining: result.remaining,
    retryAfterSeconds: result.success
      ? 0
      : Math.ceil((result.reset - Date.now()) / 1000),
  };
}

// ── General API rate limiter ─────────────────────────────────────────────────
export async function checkApiRateLimit(
  ip: string,
): Promise<RateLimitResult> {
  if (!apiLimiter) {
    return { allowed: true, remaining: 100, retryAfterSeconds: 0 };
  }

  const result = await apiLimiter.limit(ip);

  return {
    allowed: result.success,
    remaining: result.remaining,
    retryAfterSeconds: result.success
      ? 0
      : Math.ceil((result.reset - Date.now()) / 1000),
  };
}

// ── 429 Response factory ─────────────────────────────────────────────────────
export function tooManyRequestsResponse(
  retryAfterSeconds: number,
  message = 'Too many requests',
): NextResponse {
  return NextResponse.json(
    {
      error: 'RATE_LIMITED',
      message,
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': '5',
      },
    },
  );
}
