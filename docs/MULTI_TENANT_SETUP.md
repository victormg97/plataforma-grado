# Sistema Multi-Tenant — Guía de Configuración

## Descripción del Sistema

Este proyecto utiliza un enfoque **single-repo, multiple-deploys** para soportar múltiples clientes (tenants). Cada cliente tiene:

- Su propio archivo de configuración en `config/tenants/<id>.ts`
- Sus propios assets (logos, favicon) en `public/tenants/<id>/`
- Su propio proyecto Supabase (base de datos aislada)
- Su propio deploy en Vercel (o plataforma similar)

Todas las instancias comparten el mismo código fuente. La diferenciación se logra mediante la variable de entorno `NEXT_PUBLIC_TENANT_ID` que determina qué configuración cargar en build time.

## Arquitectura

```
cta-graduados/
├── config/
│   ├── schema.ts              ← Esquema Zod + tipos TypeScript
│   ├── index.ts               ← Loader de configuración (server)
│   ├── client.tsx             ← TenantProvider + hook useTenant()
│   ├── fonts.ts               ← Resolución de fuentes por tenant
│   └── tenants/
│       ├── cta-graduados.ts   ← Tenant por defecto
│       └── mi-academia.ts     ← Ejemplo de otro tenant
├── public/
│   └── tenants/
│       ├── cta-graduados/     ← Logos del tenant por defecto
│       └── mi-academia/       ← Logos de otro tenant
├── scripts/
│   └── create-tenant.ts       ← CLI para crear nuevo tenant
└── docs/
    └── MULTI_TENANT_SETUP.md  ← Este archivo
```

## Proceso Paso a Paso para Nuevo Cliente

### 1. Crear el tenant

```bash
npx tsx scripts/create-tenant.ts mi-academia
```

Esto genera:
- `config/tenants/mi-academia.ts` con valores placeholder
- `public/tenants/mi-academia/` con un README explicativo

### 2. Configurar datos del cliente

Edita `config/tenants/mi-academia.ts` con los datos reales:

```typescript
import type { TenantConfig } from '../schema';

const config: TenantConfig = {
  id: 'mi-academia',
  nombre: 'Mi Academia',
  descripcion: 'Preparación para exámenes de grado',
  logoLight: '/tenants/mi-academia/logo-light.png',
  logoDark: '/tenants/mi-academia/logo-dark.png',
  propietarios: [
    {
      nombre: 'Juan Pérez',
      email: 'juan@mi-academia.cl',
    },
  ],
  theme: {
    colorAccent: '#2563EB',      // Color principal de la marca
    colorAccentLight: '#60A5FA', // Variante clara
  },
  fonts: {
    display: 'Montserrat',  // Fuente para títulos
    body: 'Inter',          // Fuente para texto
  },
};

export default config;
```

### 3. Agregar logos

Coloca los archivos en `public/tenants/mi-academia/`:
- `logo-light.png` — Logo para tema claro (fondo transparente, ~200x60px)
- `logo-dark.png` — Logo para tema oscuro (fondo transparente, ~200x60px)
- `favicon.ico` — Favicon (opcional)
- `og-image.png` — Imagen para redes sociales (opcional, 1200x630px)

### 4. Crear proyecto Supabase

1. Ve a [supabase.com/dashboard](https://supabase.com/dashboard) y crea un nuevo proyecto
2. Anota las credenciales:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Anon Key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)
   - Database URL (`SUPABASE_DB_URL`)

### 5. Aplicar migraciones al nuevo Supabase

```bash
# Opción A: usando Supabase CLI con link
npx supabase link --project-ref <project-ref>
npx supabase db push

# Opción B: directamente con la URL de la base de datos
npx supabase db push --db-url postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
```

### 6. Ejecutar seed (crear usuario admin)

```bash
# Ejecuta el seed.sql para crear el usuario administrador inicial
npx supabase db seed --db-url <DB_URL>
```

> **Nota:** Revisa `supabase/seed.sql` y ajusta el email/contraseña del admin para el nuevo cliente.

### 7. Configurar deploy en Vercel

1. Crea un nuevo proyecto en [vercel.com](https://vercel.com)
2. Conecta el mismo repositorio
3. Configura las variables de entorno:

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_TENANT_ID` | `mi-academia` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` |
| `NEXT_PUBLIC_APP_URL` | `https://mi-academia.vercel.app` |

4. Despliega 🚀

## Requisitos por Cliente

Cada nuevo cliente necesita:

- [ ] Proyecto Supabase (plan Free o superior)
- [ ] Proyecto Vercel (plan Hobby o superior)
- [ ] Dominio personalizado (opcional)
- [ ] Logos en formato PNG con fondo transparente
- [ ] Datos del propietario (nombre, email)
- [ ] Colores de marca (accent + accent light en formato hex)

## Variables de Entorno Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NEXT_PUBLIC_TENANT_ID` | ID del tenant (kebab-case) | `mi-academia` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `https://abc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo server) | `eyJ...` |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app | `https://mi-academia.com` |

## Personalización de Colores y Logos

### Colores

Los colores se definen en el campo `theme` del archivo de configuración:

```typescript
theme: {
  colorAccent: '#2563EB',       // Color principal (botones, links, badges)
  colorAccentLight: '#60A5FA',  // Variante clara (hover, backgrounds suaves)
  // Opcionales:
  colorBg: '#FFFFFF',           // Fondo principal
  colorBgSecondary: '#F9FAFB',  // Fondo secundario
  colorTextPrimary: '#111827',  // Texto principal
  colorBorder: '#E5E7EB',       // Bordes
  dark: {                       // Overrides para modo oscuro
    colorBg: '#0F172A',
    colorBgSecondary: '#1E293B',
    colorTextPrimary: '#F1F5F9',
    colorBorder: '#334155',
  },
}
```

Los colores se inyectan como variables CSS en el `<html>` y son usados por todo el sistema de temas existente.

### Logos

- Formato: PNG con fondo transparente
- Tamaño recomendado: 200x60px (horizontal)
- Se necesitan dos versiones: una para tema claro y otra para tema oscuro
- Se colocan en `public/tenants/<id>/`

### Fuentes

Las fuentes soportadas actualmente son:

**Display (títulos):** Playfair Display, Lora, Raleway, Merriweather, Montserrat

**Body (texto):** DM Sans, Inter, Open Sans, Poppins, Roboto, Montserrat

Si necesitas agregar una fuente nueva, edita `config/fonts.ts` y agrégala al registro.

## Versionado del Esquema de Configuración

El esquema de configuración tiene un número de versión (`CURRENT_SCHEMA_VERSION` en `config/schema.ts`). Esto permite:

1. **Evolución controlada**: Cuando se agregan campos nuevos al esquema, se incrementa la versión.
2. **Compatibilidad hacia atrás**: Los campos nuevos siempre tienen valores por defecto, así los archivos de tenant existentes siguen funcionando.
3. **Validación en build time**: Si un archivo de tenant tiene campos inválidos o faltantes, el build falla con un mensaje claro indicando qué corregir.

### Proceso para actualizar el esquema

1. Agrega el nuevo campo en `config/schema.ts` con un valor `.default()` o `.optional()`
2. Incrementa `CURRENT_SCHEMA_VERSION`
3. Actualiza este documento con la nueva opción
4. Los tenants existentes seguirán funcionando sin cambios (los defaults se aplican automáticamente)

### Historial de versiones

| Versión | Cambios |
|---------|---------|
| 1 | Esquema inicial: id, nombre, descripcion, logos, propietarios, theme, fonts, metadata |

## Solución de Problemas

### Error: Tenant "xxx" no encontrado

Verifica que:
- La variable `NEXT_PUBLIC_TENANT_ID` está correctamente configurada
- Existe el archivo `config/tenants/xxx.ts`
- El archivo exporta un `default` válido

### Error: Configuración inválida

El mensaje de error indica qué campo tiene problemas. Revisa:
- Colores en formato `#RRGGBB` (6 dígitos hex)
- Email con formato válido
- Rutas de logos empiezan con `/`
- Al menos un propietario definido

### Los colores no se aplican

- Verifica que los colores están en formato hex de 6 dígitos (`#C9993F`, no `#C9993F80`)
- Limpia la caché del navegador
- Revisa que no hay CSS custom que sobreescriba las variables
