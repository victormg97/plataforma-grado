import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Public GET endpoint for landing page pricing configuration.
 *
 * Uses Next.js ISR-style caching via Cache-Control headers:
 * - `s-maxage=3600`: CDN/Vercel edge caches for 1 hour
 * - `stale-while-revalidate=86400`: serves stale while fetching fresh in background
 *
 * This means:
 * - All users share the same cached response (no per-user DB calls)
 * - Fresh data is fetched at most once per hour
 * - During revalidation, users still get instant (stale) responses
 * - When admin updates prices, next request after 1h triggers revalidation
 *
 * We use the service role key here because this is a public read endpoint
 * and RLS allows SELECT for everyone anyway — using service role avoids
 * the overhead of cookie-based session resolution for anonymous visitors.
 */

// Force dynamic so we can set cache headers (not statically rendered)
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get('tenant');

  if (!tenantSlug) {
    return NextResponse.json(
      { error: 'Missing tenant parameter' },
      { status: 400 }
    );
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('landing_planes_config')
    .select('*')
    .eq('tenant_slug', tenantSlug)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Config not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
