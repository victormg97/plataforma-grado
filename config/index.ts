import { tenantConfigSchema, type TenantConfig } from './schema';

// ─── Static tenant registry ──────────────────────────────────────────────────
// Each tenant must be imported statically so Turbopack/Webpack can resolve them
// at build time. Add new tenants here when created.
import ctaGraduados from './tenants/cta-graduados';
import preguntaEstrategica from './tenants/pregunta-estrategica';

const tenantRegistry: Record<string, unknown> = {
  'cta-graduados': ctaGraduados,
  'pregunta-estrategica': preguntaEstrategica,
};

/**
 * Lista los tenants disponibles.
 */
export function getAvailableTenants(): string[] {
  return Object.keys(tenantRegistry);
}

/**
 * Carga y valida la configuración del tenant activo.
 * Se ejecuta en build time y server runtime.
 */
function loadTenantConfig(): TenantConfig {
  const tenantId = process.env.NEXT_PUBLIC_TENANT_ID || 'cta-graduados';

  const rawConfig = tenantRegistry[tenantId];
  if (!rawConfig) {
    const available = getAvailableTenants();
    throw new Error(
      `[Sistema_Config] Tenant "${tenantId}" no encontrado.\n` +
        `Tenants disponibles: ${available.join(', ')}\n` +
        `Verifica la variable NEXT_PUBLIC_TENANT_ID`
    );
  }

  const result = tenantConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `[Sistema_Config] Configuración inválida para tenant "${tenantId}":\n${errors}`
    );
  }

  return result.data;
}

/** Singleton de configuración del tenant activo, validado con Zod */
export const tenantConfig: TenantConfig = loadTenantConfig();
