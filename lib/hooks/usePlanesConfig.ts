'use client';

import { useQuery } from '@tanstack/react-query';
import type { LandingPlanesConfig } from '@/lib/supabase/types';

/**
 * Formatted pricing data ready for rendering.
 * Transforms raw DB integers into Chilean peso formatted strings.
 */
export interface PlanesConfigFormatted {
  ofertaActiva: boolean;
  ofertaTexto: string | null;
  plan1: { nombre: string; detalle: string; precio: string; precioAntes: string | null };
  plan2: { nombre: string; detalle: string; precio: string; precioAntes: string | null };
  tutoria1: { nombre: string; detalle: string; precio: string };
  tutoria2: { nombre: string; detalle: string; precio: string };
  lectorPrecio: string;
}

/** Format CLP integer to "$XX.XXX" string */
function formatCLP(amount: number): string {
  return `$${amount.toLocaleString('es-CL')}`;
}

/** Get current month name in Spanish */
function getCurrentMonthName(): string {
  return new Date().toLocaleDateString('es-CL', { month: 'long' });
}

/** Transform raw DB row into formatted display data */
function formatConfig(raw: LandingPlanesConfig): PlanesConfigFormatted {
  // Build offer text
  let ofertaTexto: string | null = null;
  if (raw.oferta_activa) {
    if (raw.oferta_mes_automatico) {
      const month = getCurrentMonthName();
      ofertaTexto = `Oferta ${month.charAt(0).toUpperCase() + month.slice(1)}`;
    } else {
      ofertaTexto = raw.oferta_texto;
    }
  }

  return {
    ofertaActiva: raw.oferta_activa,
    ofertaTexto,
    plan1: {
      nombre: raw.plan1_nombre,
      detalle: raw.plan1_detalle,
      precio: formatCLP(raw.plan1_precio),
      precioAntes: raw.plan1_precio_antes ? `antes ${formatCLP(raw.plan1_precio_antes)}` : null,
    },
    plan2: {
      nombre: raw.plan2_nombre,
      detalle: raw.plan2_detalle,
      precio: formatCLP(raw.plan2_precio),
      precioAntes: raw.plan2_precio_antes ? `antes ${formatCLP(raw.plan2_precio_antes)}` : null,
    },
    tutoria1: {
      nombre: raw.tutoria1_nombre,
      detalle: raw.tutoria1_detalle,
      precio: formatCLP(raw.tutoria1_precio),
    },
    tutoria2: {
      nombre: raw.tutoria2_nombre,
      detalle: raw.tutoria2_detalle,
      precio: formatCLP(raw.tutoria2_precio),
    },
    lectorPrecio: formatCLP(raw.lector_precio),
  };
}

async function fetchPlanesConfig(tenantSlug: string): Promise<LandingPlanesConfig | null> {
  const res = await fetch(`/api/landing/planes?tenant=${tenantSlug}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Hook for consuming landing page pricing configuration.
 *
 * Uses a very long staleTime (10 minutes) since pricing rarely changes.
 * Combined with the server-side s-maxage=3600 cache, this means:
 * - First load: instant (server sends cached response)
 * - Subsequent navigations: uses React Query cache (no network call)
 * - Background revalidation happens silently
 */
export function usePlanesConfig(tenantSlug: string, initialData?: LandingPlanesConfig | null) {
  const { data: raw } = useQuery({
    queryKey: ['landing-planes-config', tenantSlug],
    queryFn: () => fetchPlanesConfig(tenantSlug),
    staleTime: 10 * 60_000, // 10 minutes
    gcTime: 60 * 60_000,    // 1 hour garbage collection
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
    initialData: initialData ?? undefined,
  });

  const formatted = raw ? formatConfig(raw) : null;
  return { config: formatted, raw };
}
