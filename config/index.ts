import fs from 'fs';
import path from 'path';
import { tenantConfigSchema, type TenantConfig } from './schema';

/**
 * Lista los tenants disponibles leyendo el directorio config/tenants/
 */
export function getAvailableTenants(): string[] {
  const tenantsDir = path.join(__dirname, 'tenants');

  if (!fs.existsSync(tenantsDir)) {
    return [];
  }

  return fs
    .readdirSync(tenantsDir)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
    .map((file) => file.replace(/\.(ts|js)$/, ''));
}

/**
 * Carga y valida la configuración del tenant activo.
 * Se ejecuta en build time y server runtime.
 */
function loadTenantConfig(): TenantConfig {
  const tenantId = process.env.NEXT_PUBLIC_TENANT_ID || 'cta-graduados';

  let rawConfig: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    rawConfig = require(`./tenants/${tenantId}`).default;
  } catch {
    const available = getAvailableTenants();
    throw new Error(
      `[Sistema_Config] Tenant "${tenantId}" no encontrado.\n` +
        `Tenants disponibles: ${available.length > 0 ? available.join(', ') : '(ninguno)'}\n` +
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
