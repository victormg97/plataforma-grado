import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkLoginRateLimit, getIp, tooManyRequestsResponse } from '@/lib/utils/rateLimit';
import { getRolRedirectPath } from '@/lib/auth/helpers';

export async function POST(request: NextRequest) {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let email: string;
  let password: string;
  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email.trim() : '';
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json(
      { error: 'INVALID_BODY', message: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: 'INVALID_BODY', message: 'Email and password are required' },
      { status: 400 },
    );
  }

  // ── 2. Rate limit check (before touching Supabase Auth) ────────────────────
  const ip = getIp(request);
  const rateLimit = await checkLoginRateLimit(ip, email);

  if (!rateLimit.allowed) {
    return tooManyRequestsResponse(
      rateLimit.retryAfterSeconds,
      'RATE_LIMITED',
    );
  }

  // ── 3. Attempt sign-in ─────────────────────────────────────────────────────
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    // Return 401 with remaining attempts for transparency.
    // Never reveal whether the email exists — always use the same message.
    return NextResponse.json(
      {
        error: 'INVALID_CREDENTIALS',
        remaining: rateLimit.remaining - 1,
      },
      { status: 401 },
    );
  }

  // ── 4. Load profile for redirect + preferences ─────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Session not established' },
      { status: 500 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('rol, tema, idioma')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Profile not found' },
      { status: 500 },
    );
  }

  // ── 5. Return redirect path and preferences ────────────────────────────────
  return NextResponse.json({
    redirectPath: getRolRedirectPath(profile.rol),
    tema: profile.tema ?? null,
    idioma: profile.idioma ?? null,
  });
}
