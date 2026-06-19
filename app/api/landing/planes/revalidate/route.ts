import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/landing/planes/revalidate
 *
 * Called by admin after updating pricing config.
 * Revalidates the landing page so the next visitor gets fresh data.
 * Requires authenticated admin session.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Revalidate the landing page path so fresh data is fetched on next visit
  revalidatePath('/landing');

  return NextResponse.json({ revalidated: true });
}
