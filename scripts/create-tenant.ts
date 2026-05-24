#!/usr/bin/env tsx
/**
 * Script CLI para crear un nuevo tenant.
 *
 * Uso: npx tsx scripts/create-tenant.ts <tenant-id>
 * Ejemplo: npx tsx scripts/create-tenant.ts mi-academia
 */

import fs from 'fs';
import path from 'path';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isKebabCase(value: string): boolean {
  return KEBAB_CASE_REGEX.test(value);
}

function exitWithError(message: string): never {
  console.error(`\n❌ Error: ${message}\n`);
  process.exit(1);
}

// ─── Paths ───────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const TENANTS_DIR = path.join(ROOT, 'config', 'tenants');
const PUBLIC_TENANTS_DIR = path.join(ROOT, 'public', 'tenants');

// ─── Validation ──────────────────────────────────────────────────────────────

const tenantId = process.argv[2];

if (!tenantId) {
  exitWithError(
    'Debes proporcionar un ID de tenant.\n' +
    '  Uso: npx tsx scripts/create-tenant.ts <tenant-id>\n' +
    '  Ejemplo: npx tsx scripts/create-tenant.ts mi-academia'
  );
}

if (!isKebabCase(tenantId)) {
  exitWithError(
    `"${tenantId}" no es un ID válido.\n` +
    '  El ID debe ser kebab-case (solo letras minúsculas, números y guiones).\n' +
    '  Ejemplos válidos: mi-academia, escuela-derecho, prep-grado-2024'
  );
}

const tenantConfigPath = path.join(TENANTS_DIR, `${tenantId}.ts`);
if (fs.existsSync(tenantConfigPath)) {
  exitWithError(
    `El tenant "${tenantId}" ya existe en config/tenants/${tenantId}.ts\n` +
    '  Elige un ID diferente o edita el archivo existente.'
  );
}

// ─── Generate tenant config file ─────────────────────────────────────────────

const configTemplate = `import type { TenantConfigInput } from '../schema';

const config: TenantConfigInput = {
  id: '${tenantId}',
  nombre: 'NOMBRE DE TU ACADEMIA',
  descripcion: 'Descripción breve de tu academia',
  logoLight: '/tenants/${tenantId}/logo-light.png',
  logoDark: '/tenants/${tenantId}/logo-dark.png',
  propietarios: [
    {
      nombre: 'Nombre del Propietario',
      email: 'admin@tu-dominio.cl',
    },
  ],
  theme: {
    colorAccent: '#C9993F',
    colorAccentLight: '#E8C97A',
  },
  fonts: {
    display: 'Playfair Display',
    body: 'DM Sans',
  },
};

export default config;
`;

// ─── Generate public assets directory ────────────────────────────────────────

const publicDir = path.join(PUBLIC_TENANTS_DIR, tenantId);

const readmeContent = `# Assets para tenant: ${tenantId}

Coloca aquí los archivos estáticos del tenant:

- \`logo-light.png\` — Logo para tema claro (recomendado: 200x60px, fondo transparente)
- \`logo-dark.png\` — Logo para tema oscuro (recomendado: 200x60px, fondo transparente)
- \`favicon.ico\` — Favicon (opcional)
- \`og-image.png\` — Imagen para Open Graph / redes sociales (opcional, 1200x630px)

## Notas

- Los logos deben ser PNG con fondo transparente.
- Las rutas en el archivo de configuración (\`config/tenants/${tenantId}.ts\`) ya apuntan a esta carpeta.
- Después de agregar los archivos, elimina este README.
`;

// ─── Execute ─────────────────────────────────────────────────────────────────

// Ensure directories exist
fs.mkdirSync(TENANTS_DIR, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

// Write files
fs.writeFileSync(tenantConfigPath, configTemplate, 'utf-8');
fs.writeFileSync(path.join(publicDir, 'README.md'), readmeContent, 'utf-8');

// ─── Print success & next steps ──────────────────────────────────────────────

console.log(`
✅ Tenant "${tenantId}" creado exitosamente!

📁 Archivos generados:
   • config/tenants/${tenantId}.ts  (configuración)
   • public/tenants/${tenantId}/    (assets)

📋 Siguientes pasos:

   1. Edita config/tenants/${tenantId}.ts con los datos reales del cliente
      (nombre, descripción, colores, propietario, etc.)

   2. Agrega los logos en public/tenants/${tenantId}/
      • logo-light.png (tema claro)
      • logo-dark.png (tema oscuro)

   3. Crea un nuevo proyecto en Supabase (https://supabase.com/dashboard)
      • Aplica las migraciones: npx supabase db push --db-url <DB_URL>
      • Ejecuta el seed: npx supabase db seed --db-url <DB_URL>

   4. Crea un nuevo proyecto en Vercel y configura las variables de entorno:
      • NEXT_PUBLIC_TENANT_ID=${tenantId}
      • NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
      • NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
      • SUPABASE_SERVICE_ROLE_KEY=eyJ...
      • NEXT_PUBLIC_APP_URL=https://tu-dominio.com

   5. Conecta el repositorio a Vercel y despliega 🚀
`);
