# Tareas de Implementación — Sistema Multi-Tenant por Configuración

## Task 1: Crear esquema de configuración y tipos
- [x] Crear directorio `config/` en la raíz del proyecto
- [x] Implementar el esquema Zod en `config/schema.ts` con todos los sub-esquemas (owner, theme, fonts, metadata)
- [x] Exportar el tipo `TenantConfig` inferido del esquema
- [x] Exportar constante `CURRENT_SCHEMA_VERSION`
- [x] Incluir validaciones de formato: hex colors (#RRGGBB), kebab-case para slug, emails válidos, rutas relativas
- [x] Proveer valores por defecto para campos opcionales (redes sociales, teléfono, fuente display, fuente body)

## Task 2: Implementar loader de configuración
- [x] Crear `config/index.ts` con función `loadTenantConfig()` que lee `NEXT_PUBLIC_TENANT_ID`
- [x] Implementar fallback a `"cta-graduados"` si la variable no está definida
- [x] Implementar carga dinámica del archivo de tenant desde `config/tenants/`
- [x] Implementar validación con Zod y mensajes de error descriptivos indicando campo y problema
- [x] Implementar función `getAvailableTenants()` que lista tenants disponibles
- [x] Exportar `tenantConfig` como singleton validado
- [x] Si el tenant no existe, lanzar error claro con lista de tenants disponibles

## Task 3: Crear TenantProvider para Client Components
- [x] Crear `config/client.tsx` con el contexto `TenantContext` tipado como `TenantConfig | null`
- [x] Implementar `TenantProvider` que recibe `config` como prop
- [x] Implementar hook `useTenant()` que lanza error si se usa fuera del provider
- [x] Exportar `TenantProvider` y `useTenant`

## Task 4: Crear configuración del tenant CTA Graduados (actual)
- [x] Crear directorio `config/tenants/`
- [x] Crear `config/tenants/cta-graduados.ts` con datos actuales: colores de globals.css, nombre "CTA Graduados", descripción, propietario Carlos Toro Araya
- [x] Crear directorio `public/tenants/cta-graduados/`
- [x] Copiar logos existentes de `public/assets/logo-light.png` y `logo-dark.png` a `public/tenants/cta-graduados/`
- [x] Mantener los logos originales en `public/assets/` temporalmente para no romper nada
- [x] Validar que el archivo pasa el esquema Zod importándolo y parseándolo

## Task 5: Integrar TenantProvider en el layout raíz
- [x] Importar `tenantConfig` desde `@/config` en `app/layout.tsx`
- [x] Importar `TenantProvider` desde `@/config/client`
- [x] Crear función `getTenantCSSVars()` que genera objeto de variables CSS del tenant (--color-brand-gold, --accent, --ring, etc.)
- [x] Envolver children con `<TenantProvider config={tenantConfig}>`
- [x] Agregar style attribute al `<html>` con las variables CSS del tenant
- [x] Reemplazar metadata hardcodeada por valores de `tenantConfig.nombre` y `tenantConfig.descripcion`

## Task 6: Refactorizar AppLogo para usar configuración de tenant
- [x] Importar `useTenant` desde `@/config/client` en `components/common/AppLogo/index.tsx`
- [x] Reemplazar rutas hardcodeadas `/assets/logo-dark.png` y `/assets/logo-light.png` por `tenant.logoDark` y `tenant.logoLight`
- [x] Reemplazar texto fallback "CTA Graduados" por `tenant.nombre`
- [x] Reemplazar alt text "CTA Graduados" por `tenant.nombre`

## Task 7: Refactorizar Sidebar y Navbar para usar configuración de tenant
- [x] En `components/layout/Sidebar/index.tsx`: importar `useTenant`, reemplazar "CTA Graduados" en el footer por `tenant.nombre`
- [x] En `components/layout/Navbar/index.tsx`: importar `useTenant`, reemplazar "CTA Graduados" en el title por `tenant.nombre`

## Task 8: Implementar resolución dinámica de fuentes
- [x] Crear `config/fonts.ts` con un mapa de fuentes soportadas de Google Fonts
- [x] Implementar función que retorna las fuentes correctas según la configuración del tenant
- [x] Modificar `app/layout.tsx` para usar las fuentes del tenant en vez de las hardcodeadas (Playfair Display, DM Sans)
- [x] Asegurar que las fuentes por defecto se usan si el tenant no define fuentes personalizadas

## Task 9: Crear script CLI para nuevo tenant
- [x] Crear `scripts/create-tenant.ts` con validación del argumento (kebab-case, no duplicado)
- [x] Generar `config/tenants/<id>.ts` con template y valores placeholder
- [x] Crear directorio `public/tenants/<id>/` con README indicando qué archivos agregar
- [x] Imprimir instrucciones de siguiente paso en consola (configurar Supabase, variables de entorno, deploy)
- [x] Agregar script a `package.json`: `"create-tenant": "tsx scripts/create-tenant.ts"`

## Task 10: Actualizar .env.example y documentar proceso de onboarding
- [x] Agregar `NEXT_PUBLIC_TENANT_ID=cta-graduados` a `.env.example`
- [x] Crear `docs/MULTI_TENANT_SETUP.md` con explicación del sistema, proceso paso a paso para nuevo cliente, requisitos, variables de entorno, cómo aplicar migraciones, y cómo personalizar colores/logos
- [x] Documentar el versionado del esquema de configuración

## Task 11: Integrar nombre del tenant con sistema i18n
- [x] Identificar todos los lugares en `messages/es.json` donde aparece "CTA Graduados" hardcodeado
- [x] Reemplazar por placeholder genérico o eliminar (el nombre viene del tenant config)
- [x] Actualizar `messages/en.json` si existe con los mismos cambios
- [x] Verificar que componentes que usan `useTranslations` para textos del tenant funcionan con el valor del provider

## Task 12: Verificación final y build completo
- [x] Ejecutar `npm run build` y verificar que no hay errores
- [x] Ejecutar `npm run lint` y corregir warnings
- [x] Verificar que la app funciona con el tenant `cta-graduados` (default)
- [x] Verificar que un tenant inexistente produce error claro en build
- [x] Ejecutar tests existentes (`npm run test`) y verificar que pasan
