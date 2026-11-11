'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { TenantContactInfo } from '@/lib/supabase/types';

async function fetchContactInfo(tenantSlug: string): Promise<TenantContactInfo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tenant_contact_info')
    .select('*')
    .eq('tenant_slug', tenantSlug)
    .eq('activo', true)
    .order('sort_order', { ascending: true });

  if (error || !data) return [];
  // Entradas sin valor o sin enlace no se pueden mostrar de forma útil.
  return data.filter((e) => e.value?.trim() && e.url?.trim());
}

export function useContactInfo(tenantSlug: string) {
  const { data } = useQuery({
    queryKey: ['who-we-are-contact-info', tenantSlug],
    queryFn: () => fetchContactInfo(tenantSlug),
    staleTime: 5 * 60_000,
    retry: false,
  });

  return { entries: data ?? [] };
}
