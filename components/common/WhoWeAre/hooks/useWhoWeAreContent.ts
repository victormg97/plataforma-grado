'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

type ContentStatus = 'loading' | 'resolved' | 'not_found';

interface WhoWeAreContentResult {
  markdown: string | null;
  status: ContentStatus;
}

async function fetchMarkdownFromStorage(
  tenantSlug: string,
  locale: string,
  signal: AbortSignal
): Promise<string | null> {
  const supabase = createClient();
  const path = `content/tenants/${tenantSlug}/${locale}/quienes-somos.md`;

  // Get the public URL
  const { data } = supabase.storage.from('content').getPublicUrl(path);
  if (!data?.publicUrl) return null;

  try {
    const res = await fetch(data.publicUrl, { signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function resolveContent(tenantSlug: string, locale: string): Promise<WhoWeAreContentResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    // Try locale-specific first
    const localeContent = await fetchMarkdownFromStorage(tenantSlug, locale, controller.signal);
    if (localeContent !== null) {
      return { markdown: localeContent, status: 'resolved' };
    }

    // Fall back to Spanish if locale is not 'es'
    if (locale !== 'es') {
      const esContent = await fetchMarkdownFromStorage(tenantSlug, 'es', controller.signal);
      if (esContent !== null) {
        return { markdown: esContent, status: 'resolved' };
      }
    }

    return { markdown: null, status: 'not_found' };
  } catch {
    return { markdown: null, status: 'not_found' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function useWhoWeAreContent(tenantSlug: string, locale: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['who-we-are-content', tenantSlug, locale],
    queryFn: () => resolveContent(tenantSlug, locale),
    staleTime: 5 * 60_000, // 5 minutes
    retry: false,
  });

  if (isLoading || !data) {
    return { markdown: null, status: 'loading' as ContentStatus };
  }

  return data;
}
