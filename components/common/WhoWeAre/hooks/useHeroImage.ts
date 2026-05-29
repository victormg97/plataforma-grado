'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'] as const;

async function probeHeroImage(tenantSlug: string): Promise<{ url: string | null; found: boolean }> {
  const supabase = createClient();

  for (const ext of EXTENSIONS) {
    const path = `content/tenants/${tenantSlug}/quienes-somos-image.${ext}`;
    const { data } = supabase.storage.from('content').getPublicUrl(path);
    if (!data?.publicUrl) continue;

    try {
      const res = await fetch(data.publicUrl, { method: 'HEAD' });
      if (res.ok) {
        return { url: data.publicUrl, found: true };
      }
    } catch {
      // treat as not found, try next extension
    }
  }

  return { url: null, found: false };
}

export function useHeroImage(tenantSlug: string) {
  const { data } = useQuery({
    queryKey: ['who-we-are-hero-image', tenantSlug],
    queryFn: () => probeHeroImage(tenantSlug),
    staleTime: 5 * 60_000,
    retry: false,
  });

  return data ?? { url: null, found: false };
}
