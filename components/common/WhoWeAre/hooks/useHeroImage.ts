'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'] as const;

async function probeHeroImage(tenantSlug: string): Promise<{ url: string | null; found: boolean }> {
  const supabase = createClient();

  // Single Storage list call instead of 6 HEAD requests
  const folder = `tenants/${tenantSlug}`;
  const { data: files, error } = await supabase.storage
    .from('content')
    .list(folder, { search: 'quienes-somos-image' });

  if (error || !files || files.length === 0) {
    return { url: null, found: false };
  }

  // Find the first matching file in extension priority order
  for (const ext of EXTENSIONS) {
    const match = files.find((f) => f.name === `quienes-somos-image.${ext}`);
    if (match) {
      const { data } = supabase.storage
        .from('content')
        .getPublicUrl(`${folder}/quienes-somos-image.${ext}`);
      return { url: data.publicUrl, found: true };
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
