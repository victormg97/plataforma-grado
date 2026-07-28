# Diseño Técnico — Sistema Multi-Tenant por Configuración

## Resumen

Este documento describe la arquitectura técnica para implementar el sistema de configuración multi-tenant. El enfoque es un único repositorio con archivos de configuración por tenant, donde cada despliegue es una instancia independiente diferenciada por variables de entorno.

## Arquitectura General

```
cta-graduados/
├── config/
│   ├── tenants/
│   │   ├── cta-graduados.ts      ← Tenant por defecto (actual)
│   │   └── [nuevo-cliente].ts    ← Cada nuevo cliente
│   ├── schema.ts                 ← Esquema Zod + tipos
│   ├── index.ts                  ← Loader principal (server)
│   └── client.tsx                ← Provider para Client Components
├── public/
│   └── tenants/
│       ├── cta-graduados/
│       │   ├── logo-light.png
│       │   └── logo-dark.png
│       └── [nuevo-cliente]/
│           ├── logo-light.png
│           └── logo-dark.png
├── scripts/
│   └── create-tenant.ts          ← CLI para crear nuevo tenant
└── ...
```

## Componentes del Sistema

### 1. Esquema de Configuración (`config/schema.ts`)

Define la estructura del Archivo_Tenant usando Zod para validación runtime y TypeScript para tipado estático.

```typescript
import { z } from 'zod';

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser formato #RRGGBB');
const kebabCaseSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Debe ser kebab-case');
const relativePathSchema = z.string().startsWith('/');

const ownerSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  telefono: z.string().optional(),
  redesSociales: z.object({
    instagram: z.string().url().optional(),
    facebook: z.string().url().optional(),
    linkedin: z.string().url().optional(),
    whatsapp: z.string().optional(),
  }).optional(),
});

const themeSchema = z.object({
  colorAccent: hexColorSchema,
  colorAccentLight: hexColorSchema,
  colorBg: hexColorSchema.optional(),
  colorBgSecondary: hexColorSchema.optional(),
  colorTextPrimary: hexColorSchema.optional(),
  colorBorder: hexColorSchema.optional(),
  // Dark mode overrides
  dark: z.object({
    colorBg: hexColorSchema.optional(),
    colorBgSecondary: hexColorSchema.optional(),
    colorTextPrimary: hexColorSchema.optional(),
    colorBorder: hexColorSchema.optional(),
  }).optional(),
});

const fontsSchema = z.object({
  display: z.string().optional(),  // Google Font name, e.g. "Playfair Display"
  body: z.string().optional(),     // Google Font name, e.g. "DM Sans"
}).optional();

export const tenantConfigSchema = z.object({
  id: kebabCaseSchema,
  nombre: z.string().min(1),
  descripcion: z.string().min(1),
  logoLight: relativePathSchema,
  logoDark: relativePathSchema,
  propietarios: z.array(ownerSchema).min(1),
  theme: themeSchema,
  fonts: fontsSchema,
  metadata: z.object({
    ogImage: relativePathSchema.optional(),
    favicon: relativePathSchema.optional(),
  }).optional(),
});

export type TenantConfig = z.infer<typeof tenantConfigSchema>;
```

### 2. Loader de Configuración (`config/index.ts`)

Carga y valida la configuración del tenant activo. Se ejecuta en build time y server runtime.

```typescript
import { tenantConfigSchema, type TenantConfig } from './schema';

function loadTenantConfig(): TenantConfig {
  const tenantId = process.env.NEXT_PUBLIC_TENANT_ID || 'cta-graduados';
  
  let rawConfig: unknown;
  try {
    // Dynamic import del archivo de configuración
    rawConfig = require(`./tenants/${tenantId}`).default;
  } catch {
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
      .map(i => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `[Sistema_Config] Configuración inválida para tenant "${tenantId}":\n${errors}`
    );
  }

  return result.data;
}

export const tenantConfig: TenantConfig = loadTenantConfig();
```

### 3. Provider para Client Components (`config/client.tsx`)

Expone la configuración del tenant a Client Components via React Context.

```typescript
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { TenantConfig } from './schema';

const TenantContext = createContext<TenantConfig | null>(null);

export function TenantProvider({ 
  config, 
  children 
}: { 
  config: TenantConfig; 
  children: ReactNode 
}) {
  return (
    <TenantContext.Provider value={config}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantConfig {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return ctx;
}
```

### 4. Inyección de Variables CSS (`app/layout.tsx`)

El layout raíz inyecta las variables CSS del tenant como inline styles en el `<html>`.

```typescript
// En el RootLayout:
import { tenantConfig } from '@/config';

// Genera el style string con las variables del tenant
function getTenantCSSVars(config: TenantConfig): string {
  const vars: Record<string, string> = {
    '--color-brand-gold': config.theme.colorAccent,
    '--color-brand-gold-light': config.theme.colorAccentLight,
    '--color-brand-gold-muted': `${config.theme.colorAccent}26`,
    '--accent': config.theme.colorAccent,
    '--ring': config.theme.colorAccent,
  };
  
  if (config.theme.colorBg) vars['--color-bg'] = config.theme.colorBg;
  if (config.theme.colorBgSecondary) vars['--color-bg-secondary'] = config.theme.colorBgSecondary;
  if (config.theme.colorTextPrimary) vars['--color-text-primary'] = config.theme.colorTextPrimary;
  if (config.theme.colorBorder) vars['--color-border'] = config.theme.colorBorder;

  return Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
}
```

### 5. Carga Dinámica de Fuentes

Si el tenant define fuentes personalizadas, se cargan dinámicamente usando `next/font/google`.

```typescript
// config/fonts.ts
import { tenantConfig } from '@/config';

// Las fuentes se resuelven en build time
// Si el tenant no define fuentes, se usan las por defecto
export function getTenantFonts() {
  const displayFont = tenantConfig.fonts?.display || 'Playfair Display';
  const bodyFont = tenantConfig.fonts?.body || 'DM Sans';
  return { displayFont, bodyFont };
}
```

**Nota:** Dado que `next/font` requiere strings estáticos en build time, se usará un approach con `@next/font` dinámico o se pre-registrarán las fuentes soportadas en un mapa.

### 6. Refactorización de Componentes Existentes

#### AppLogo
```typescript
// Antes: hardcoded "CTA Graduados" y rutas fijas
// Después: usa tenantConfig
import { useTenant } from '@/config/client';

export function AppLogo({ variant = 'sidebar' }: AppLogoProps) {
  const tenant = useTenant();
  const { resolvedTheme } = useTheme();
  
  const logoSrc = resolvedTheme === 'dark' ? tenant.logoDark : tenant.logoLight;
  const fallbackText = tenant.nombre;
  // ...
}
```

#### Sidebar Footer
```typescript
// Antes: <span>CTA Graduados</span>
// Después:
const tenant = useTenant();
<span>{tenant.nombre}</span>
```

#### Navbar Title
```typescript
// Antes: <span>CTA Graduados</span>
// Después:
const tenant = useTenant();
<span>{tenant.nombre}</span>
```

#### Layout Metadata
```typescript
// Antes: hardcoded metadata
// Después:
import { tenantConfig } from '@/config';

export const metadata: Metadata = {
  title: `${tenantConfig.nombre} — ${tenantConfig.descripcion}`,
  description: tenantConfig.descripcion,
};
```

### 7. Estructura de Assets por Tenant

```
public/
└── tenants/
    ├── cta-graduados/
    │   ├── logo-light.png
    │   ├── logo-dark.png
    │   ├── favicon.ico
    │   └── og-image.png
    └── nuevo-cliente/
        ├── logo-light.png
        ├── logo-dark.png
        ├── favicon.ico
        └── og-image.png
```

Las rutas en el Archivo_Tenant referencian estos assets:
```typescript
logoLight: '/tenants/cta-graduados/logo-light.png',
logoDark: '/tenants/cta-graduados/logo-dark.png',
```

### 8. Script de Creación de Tenant (`scripts/create-tenant.ts`)

Script CLI ejecutable con `npx tsx scripts/create-tenant.ts <tenant-id>`:

1. Valida que el `tenant-id` sea kebab-case y no exista ya.
2. Crea `config/tenants/<tenant-id>.ts` con template y valores placeholder.
3. Crea `public/tenants/<tenant-id>/` con archivos placeholder.
4. Imprime instrucciones de siguiente paso (configurar Supabase, variables de entorno, deploy).

### 9. Proceso de Onboarding de Nuevo Cliente

```
1. Ejecutar: npx tsx scripts/create-tenant.ts mi-academia
2. Editar: config/tenants/mi-academia.ts (datos reales del cliente)
3. Agregar: logos en public/tenants/mi-academia/
4. Crear: proyecto Supabase nuevo → aplicar migraciones
5. Configurar: variables de entorno en Vercel
   - NEXT_PUBLIC_TENANT_ID=mi-academia
   - NEXT_PUBLIC_SUPABASE_URL=...
   - NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   - SUPABASE_SERVICE_ROLE_KEY=...
6. Deploy: conectar repo a nuevo proyecto Vercel
7. Seed: ejecutar seed.sql en el nuevo Supabase (crear admin)
```

### 10. Versionado del Esquema

El esquema incluye un campo `schemaVersion` interno:

```typescript
// En schema.ts
export const CURRENT_SCHEMA_VERSION = 1;

// En el loader, si se detecta un archivo sin campos nuevos:
// - Se aplican defaults
// - Se emite warning en build: "Tenant X usa schema v0, actualizar a v1"
```

## Decisiones de Diseño

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Config en TypeScript (no JSON) | JSON puro | TS da autocompletado, validación en IDE, y permite comentarios |
| Validación con Zod | Solo TypeScript types | Zod valida en runtime (build time), TS solo en compile time |
| Variables CSS inline en html | CSS-in-JS / Tailwind config dinámico | Mínimo impacto, compatible con sistema existente de temas |
| Assets en `/public/tenants/` | CDN externo | Simplicidad, funciona con Vercel sin config extra |
| Un Supabase por cliente | Multi-tenant con tenant_id | Aislamiento total, sin cambios al schema, free tier por cliente |
| React Context para client | Zustand store | Configuración inmutable, no necesita estado reactivo |

## Compatibilidad con Sistema Existente

- **next-themes**: Sigue funcionando igual. Los colores del tenant se inyectan como base, y las variantes dark/light/graduado se aplican encima.
- **next-intl**: Los mensajes compartidos (`messages/es.json`) no cambian. El nombre del tenant se inyecta via interpolación.
- **Zustand stores**: No se modifican. La configuración del tenant es estática (no cambia en runtime).
- **React Query**: No se ve afectado. Las queries siguen apuntando al Supabase de la instancia.
- **RLS/Auth**: Sin cambios. Cada instancia tiene su propio Supabase con el mismo esquema.

## Archivos a Crear

| Archivo | Propósito |
|---|---|
| `config/schema.ts` | Esquema Zod + tipos TypeScript |
| `config/index.ts` | Loader y exportación de config |
| `config/client.tsx` | TenantProvider + hook useTenant |
| `config/fonts.ts` | Resolución de fuentes por tenant |
| `config/tenants/cta-graduados.ts` | Config del tenant actual |
| `scripts/create-tenant.ts` | CLI para crear nuevo tenant |
| `public/tenants/cta-graduados/` | Assets del tenant actual (mover logos existentes) |

## Archivos a Modificar

| Archivo | Cambio |
|---|---|
| `app/layout.tsx` | Agregar TenantProvider, inyectar CSS vars, metadata dinámica |
| `components/common/AppLogo/index.tsx` | Usar useTenant() en vez de rutas hardcoded |
| `components/layout/Sidebar/index.tsx` | Reemplazar "CTA Graduados" por tenant.nombre |
| `components/layout/Navbar/index.tsx` | Reemplazar "CTA Graduados" por tenant.nombre |
| `.env.example` | Agregar NEXT_PUBLIC_TENANT_ID |

## Propiedades de Correctitud

1. **Validación completa**: Para todo Archivo_Tenant válido según el esquema Zod, el Sistema_Config carga sin errores y produce un objeto TenantConfig completo.
2. **Fallback consistente**: Para todo Archivo_Tenant con campos opcionales omitidos, el Sistema_Config produce un objeto con valores por defecto válidos.
3. **Aislamiento de instancias**: Dos instancias con diferentes `NEXT_PUBLIC_TENANT_ID` producen configuraciones completamente independientes sin interferencia.
4. **Compatibilidad de temas**: Para todo tenant con tema personalizado, las variantes light/dark/graduado siguen funcionando correctamente con los colores del tenant como base.
5. **Round-trip de esquema**: Un Archivo_Tenant que pasa validación Zod, al ser serializado y re-parseado, produce el mismo objeto TenantConfig.
