# Documento de Requerimientos — Sistema Multi-Tenant por Configuración

## Introducción

Este documento define los requerimientos para transformar la aplicación "CTA Graduados" en una plataforma configurable que pueda desplegarse para múltiples clientes (profesores que preparan alumnos para exámenes de grado). Se adopta un enfoque **híbrido**: un único repositorio con archivos de configuración por tenant, donde cada despliegue corresponde a una instancia separada (Vercel + Supabase independientes por cliente), pero el código fuente es compartido.

### Enfoque Seleccionado: Configuración por Tenant + Despliegues Independientes

**Justificación:**
- **Aislamiento total de datos**: Cada cliente tiene su propio proyecto Supabase (sin necesidad de `tenant_id` ni RLS multi-tenant).
- **Free tier aprovechado**: Cada cliente usa su propio free tier de Supabase y Vercel.
- **Mantenimiento centralizado**: Un solo repositorio; las actualizaciones se propagan con `git pull` + redeploy.
- **Personalización por cliente**: Cada instancia tiene su propio archivo de configuración con branding, colores, logos y datos de contacto.
- **Complejidad mínima**: No requiere middleware de detección de tenant ni base de datos compartida.

## Glosario

- **Sistema_Config**: El módulo de configuración que carga y valida los datos del tenant activo en tiempo de build y runtime.
- **Archivo_Tenant**: Archivo TypeScript/JSON que contiene toda la configuración de branding, contacto y metadatos de un cliente específico.
- **Instancia**: Un despliegue independiente de la aplicación (un proyecto Vercel + un proyecto Supabase) para un cliente.
- **Cliente**: Un profesor o academia que contrata el uso de la plataforma.
- **Tema_Visual**: El conjunto de variables CSS (colores, fuentes, radios, sombras) que definen la apariencia de una instancia.
- **Variable_Entorno**: Variable de entorno que identifica qué configuración de tenant cargar en una instancia.

## Requerimientos

### Requerimiento 1: Estructura del Archivo de Configuración de Tenant

**User Story:** Como desarrollador, quiero un esquema de configuración bien definido y validado, para que cada nuevo cliente pueda configurarse de forma consistente y sin errores.

#### Criterios de Aceptación

1. THE Sistema_Config SHALL definir un esquema TypeScript que incluya: nombre de la aplicación, descripción, slug identificador, logos (variante clara y oscura), color primario, color acento, color de fondo, fuente display, fuente body, datos de contacto del propietario (nombre, email, teléfono), y enlaces a redes sociales opcionales.
2. WHEN el Sistema_Config carga un Archivo_Tenant, THE Sistema_Config SHALL validar que todos los campos obligatorios estén presentes y tengan el formato correcto.
3. IF un Archivo_Tenant contiene campos inválidos o faltantes, THEN THE Sistema_Config SHALL lanzar un error descriptivo durante el build indicando el campo y el problema específico.
4. THE Sistema_Config SHALL proveer valores por defecto para campos opcionales (redes sociales, teléfono, fuente display, fuente body) cuando no estén definidos en el Archivo_Tenant.
5. WHEN se agrega un nuevo Archivo_Tenant al repositorio, THE Sistema_Config SHALL permitir su uso sin modificar ningún otro archivo del sistema más allá de la Variable_Entorno.

### Requerimiento 2: Carga Dinámica de Configuración

**User Story:** Como desarrollador, quiero que la aplicación cargue la configuración del tenant correcto según una variable de entorno, para que el mismo código funcione para cualquier cliente.

#### Criterios de Aceptación

1. THE Sistema_Config SHALL leer la Variable_Entorno `NEXT_PUBLIC_TENANT_ID` para determinar qué Archivo_Tenant cargar.
2. IF la Variable_Entorno `NEXT_PUBLIC_TENANT_ID` no está definida, THEN THE Sistema_Config SHALL usar el valor `"cta-graduados"` como tenant por defecto.
3. WHEN la aplicación se inicia, THE Sistema_Config SHALL exportar un objeto de configuración tipado accesible desde cualquier componente server o client.
4. THE Sistema_Config SHALL hacer disponible la configuración del tenant tanto en Server Components (importación directa) como en Client Components (mediante un provider de React Context).
5. IF el Archivo_Tenant referenciado por la Variable_Entorno no existe, THEN THE Sistema_Config SHALL fallar el build con un mensaje de error claro indicando los tenants disponibles.

### Requerimiento 3: Branding Dinámico — Logos y Nombre

**User Story:** Como cliente, quiero que mi plataforma muestre mi logo y nombre de marca, para que mis alumnos identifiquen la aplicación como propia.

#### Criterios de Aceptación

1. WHEN la aplicación renderiza el componente AppLogo, THE Sistema_Config SHALL proveer la ruta al logo correspondiente al tema activo (claro u oscuro) del tenant actual.
2. WHEN la aplicación renderiza metadatos HTML (title, description, og:image), THE Sistema_Config SHALL usar el nombre y descripción del tenant actual.
3. THE Sistema_Config SHALL reemplazar todas las referencias hardcodeadas a "CTA Graduados" por el nombre dinámico del tenant en: Sidebar footer, Navbar title, AppLogo fallback text, y metadatos del layout.
4. IF el logo del tenant no se puede cargar (error de red o archivo faltante), THEN THE Sistema_Config SHALL mostrar el nombre del tenant como texto con la fuente display configurada.

### Requerimiento 4: Tematización Visual por Tenant

**User Story:** Como cliente, quiero que mi plataforma tenga mis colores corporativos, para mantener coherencia con mi marca personal.

#### Criterios de Aceptación

1. THE Sistema_Config SHALL permitir que cada Archivo_Tenant defina un Tema_Visual con: color primario (acento), color primario claro, color de fondo, color de fondo secundario, color de texto primario, y color de borde.
2. WHEN la aplicación se carga, THE Sistema_Config SHALL inyectar las variables CSS del Tema_Visual del tenant activo en el `:root` del documento, sobrescribiendo los valores por defecto.
3. THE Sistema_Config SHALL mantener compatibilidad con el sistema de temas existente (light/dark/graduado), aplicando los colores del tenant como base para cada variante de tema.
4. IF un Archivo_Tenant no define un Tema_Visual completo, THEN THE Sistema_Config SHALL usar los colores por defecto de CTA Graduados para los campos no especificados.
5. WHEN el tenant define fuentes personalizadas, THE Sistema_Config SHALL cargar las fuentes desde Google Fonts dinámicamente en el layout raíz.

### Requerimiento 5: Configuración de Contacto y Propietario

**User Story:** Como cliente, quiero que la información de contacto visible en la app sea la mía, para que mis alumnos puedan comunicarse conmigo directamente.

#### Criterios de Aceptación

1. THE Sistema_Config SHALL incluir en el Archivo_Tenant los datos del propietario: nombre completo, email de contacto, teléfono (opcional), y enlaces a redes sociales (opcional).
2. WHEN la aplicación muestra información de contacto o créditos (footer, página "Acerca de", emails automáticos), THE Sistema_Config SHALL usar los datos del propietario del tenant activo.
3. THE Sistema_Config SHALL permitir definir múltiples propietarios en un Archivo_Tenant para academias con más de un profesor principal.

### Requerimiento 6: Internacionalización Compatible con Multi-Tenant

**User Story:** Como desarrollador, quiero que el sistema de i18n funcione correctamente con la configuración por tenant, para que los textos dinámicos del tenant se integren con las traducciones existentes.

#### Criterios de Aceptación

1. THE Sistema_Config SHALL inyectar el nombre del tenant y otros textos configurables en el sistema de mensajes de next-intl sin requerir archivos de traducción separados por tenant.
2. WHEN un componente usa `useTranslations` para acceder a textos que dependen del tenant (nombre de la app, descripción), THE Sistema_Config SHALL proveer esos valores desde el Archivo_Tenant.
3. THE Sistema_Config SHALL mantener los archivos `messages/es.json` y `messages/en.json` como base compartida, sin duplicarlos por tenant.

### Requerimiento 7: Estrategia de Despliegue por Cliente

**User Story:** Como desarrollador, quiero un proceso claro y documentado para desplegar la aplicación para un nuevo cliente, para minimizar el tiempo y esfuerzo de onboarding.

#### Criterios de Aceptación

1. THE Sistema_Config SHALL documentar un proceso de onboarding de nuevo cliente que incluya: crear Archivo_Tenant, agregar assets (logos), configurar proyecto Supabase, y desplegar en Vercel.
2. WHEN se despliega una nueva Instancia, THE Sistema_Config SHALL requerir únicamente: la Variable_Entorno `NEXT_PUBLIC_TENANT_ID`, las variables de Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), y los assets del tenant en `/public/tenants/{tenant-id}/`.
3. THE Sistema_Config SHALL permitir que múltiples instancias compartan el mismo repositorio Git, diferenciándose solo por variables de entorno y assets.
4. THE Sistema_Config SHALL incluir un script o comando CLI que genere la estructura base de un nuevo Archivo_Tenant con valores placeholder.

### Requerimiento 8: Propagación de Actualizaciones

**User Story:** Como desarrollador, quiero que las actualizaciones de funcionalidad se propaguen a todos los clientes de forma sencilla, para no mantener múltiples forks divergentes.

#### Criterios de Aceptación

1. THE Sistema_Config SHALL garantizar que el código de la aplicación sea agnóstico al tenant, de modo que un `git pull` + redeploy actualice la funcionalidad sin afectar la configuración del cliente.
2. THE Sistema_Config SHALL versionar el esquema de configuración del tenant, de modo que cambios en la estructura del Archivo_Tenant sean detectados y migrables.
3. IF una actualización del sistema introduce nuevos campos obligatorios en el esquema del Archivo_Tenant, THEN THE Sistema_Config SHALL proveer valores por defecto temporales y emitir una advertencia en el build hasta que el desarrollador actualice el Archivo_Tenant.

### Requerimiento 9: Validación y Tipado del Sistema de Configuración

**User Story:** Como desarrollador, quiero que el sistema de configuración esté completamente tipado y validado, para prevenir errores en runtime y facilitar el autocompletado en el IDE.

#### Criterios de Aceptación

1. THE Sistema_Config SHALL definir el esquema del Archivo_Tenant usando Zod para validación en runtime y TypeScript para tipado estático.
2. THE Sistema_Config SHALL exportar el tipo `TenantConfig` inferido del esquema Zod, utilizable en toda la aplicación.
3. WHEN un desarrollador crea un nuevo Archivo_Tenant, THE Sistema_Config SHALL proveer autocompletado completo en el IDE gracias al tipado TypeScript.
4. THE Sistema_Config SHALL validar formatos específicos: colores en formato hexadecimal (#RRGGBB), URLs de logos como rutas relativas válidas, emails con formato válido, y slug del tenant en formato kebab-case.

### Requerimiento 10: Compatibilidad con Base de Datos Existente

**User Story:** Como desarrollador, quiero que el esquema de base de datos actual funcione sin modificaciones para cada instancia, para mantener la simplicidad del modelo single-tenant.

#### Criterios de Aceptación

1. THE Sistema_Config SHALL mantener el esquema de base de datos actual sin agregar columnas de `tenant_id` ni modificar las políticas RLS existentes.
2. WHEN se crea una nueva Instancia, THE Sistema_Config SHALL requerir un proyecto Supabase independiente con el mismo esquema de migraciones aplicado.
3. THE Sistema_Config SHALL incluir las migraciones SQL existentes como parte del proceso de onboarding, ejecutables en el nuevo proyecto Supabase del cliente.
4. THE Sistema_Config SHALL documentar que cada Instancia opera con aislamiento total de datos (base de datos separada por cliente).
