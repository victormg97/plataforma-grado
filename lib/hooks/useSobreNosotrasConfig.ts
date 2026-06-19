'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { LandingSobreNosotrasConfig } from '@/lib/supabase/types';

export interface SobreNosotrasPersona {
  nombre: string;
  prefijo: string;
  imageUrl: string | null;
}

export interface SobreNosotrasConfigFormatted {
  persona1: SobreNosotrasPersona;
  persona2: SobreNosotrasPersona;
}

function getPublicUrl(path: string | null): string | null {
  if (!path) return null;
  const supabase = createClient();
  const { data } = supabase.storage.from('content').getPublicUrl(path);
  return data.publicUrl;
}

function formatConfig(raw: LandingSobreNosotrasConfig): SobreNosotrasConfigFormatted {
  return {
    persona1: {
      nombre: raw.persona1_nombre,
      prefijo: raw.persona1_prefijo,
      imageUrl: getPublicUrl(raw.persona1_image_path),
    },
    persona2: {
      nombre: raw.persona2_nombre,
      prefijo: raw.persona2_prefijo,
      imageUrl: getPublicUrl(raw.persona2_image_path),
    },
  };
}

async function fetchConfig(tenantSlug: string): Promise<LandingSobreNosotrasConfig | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('landing_sobre_nosotras_config')
    .select('*')
    .eq('tenant_slug', tenantSlug)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Hook for consuming "Sobre Nosotras" section configuration.
 * Returns the two personas with their names, prefixes, and image URLs.
 */
export function useSobreNosotrasConfig(tenantSlug: string, initialData?: LandingSobreNosotrasConfig | null) {
  const { data: raw } = useQuery({
    queryKey: ['landing-sobre-nosotras-config', tenantSlug],
    queryFn: () => fetchConfig(tenantSlug),
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
    initialData: initialData ?? undefined,
  });

  const formatted = raw ? formatConfig(raw) : null;
  return { config: formatted, raw };
}
