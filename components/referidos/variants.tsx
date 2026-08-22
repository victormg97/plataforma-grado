'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { tenantConfig } from '@/config';
import type {
  ReferralRewardRule,
  ReferralSettings,
  ReferralUsageEnriched,
} from '@/lib/referidos/types';

/**
 * Datos que la ruta ya consultó y entrega a la vista del tenant. La ruta sigue
 * siendo la dueña del data fetching y de los flags de activación; la variante
 * solo se encarga de la presentación.
 */
export interface ReferidosViewProps {
  settings: ReferralSettings;
  /** Código personal del usuario, o `null` si aún no se ha generado. */
  code: string | null;
  usages: ReferralUsageEnriched[];
  rules: ReferralRewardRule[];
  /** Id del usuario actual (para excluir su propio registro del conteo). */
  userId: string;
}

/**
 * Registro de vistas de referidos por tenant.
 *
 * Los tenants que quieren un diseño propio para su página de referidos se
 * registran aquí. El componente se carga de forma dinámica, así que solo entra
 * al bundle el del tenant activo. Los tenants sin entrada usan la composición
 * genérica de la ruta (MiCodigoCard + ListaReferidos + RecompensasCard).
 *
 * Para añadir un tenant nuevo:
 *   1. Crea `components/referidos/tenants/<tenantId>/<Vista>.tsx` con
 *      `export default` y props `ReferidosViewProps`.
 *   2. Crea sus mensajes i18n en
 *      `messages/pages/<locale>/referidos-<tenantId>.json`.
 *   3. Regístralo en este mapa.
 */
const referidosVariantRegistry: Record<string, ComponentType<ReferidosViewProps>> = {
  'pregunta-estrategica': dynamic(
    () => import('./tenants/pregunta-estrategica/ComunidadEstrategica')
  ),
};

/** Devuelve true si el tenant activo tiene una vista de referidos propia. */
export function tenantHasReferidosVariant(): boolean {
  return Boolean(referidosVariantRegistry[tenantConfig.id]);
}

/**
 * Renderiza la vista de referidos del tenant activo. Devuelve null si el tenant
 * no tiene variante (la ruta debe manejar el fallback).
 */
export function TenantReferidosView(props: ReferidosViewProps) {
  const View = referidosVariantRegistry[tenantConfig.id];
  if (!View) return null;
  return <View {...props} />;
}
