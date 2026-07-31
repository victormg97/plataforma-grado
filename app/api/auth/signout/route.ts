import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  // Clear the role cache cookie used by the proxy for fast role checks
  response.cookies.set('x-user-rol', '', { maxAge: 0, path: '/' });
  return response;
}
