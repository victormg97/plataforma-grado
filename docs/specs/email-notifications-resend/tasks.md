# Implementation Plan: Notificaciones por Correo con Resend

## Overview

Este plan convierte el diseño en una serie de pasos de codificación incrementales para incorporar el envío de correo transaccional mediante Resend como complemento de las notificaciones realtime existentes, de forma genérica y multitenant.

El trabajo se organiza en fases secuenciadas por dependencias: primero el setup (dependencia, variable de entorno, migración y tipos), luego el núcleo del módulo `lib/email/`, después el backend (API de perfil y CRUD de plantillas), la integración en los tres puntos de disparo, la UI con i18n, la activación por tenant y, por último, la verificación de build y tipos.

El proyecto vive en el subdirectorio `cta-graduados/`. Todas las rutas de archivo de las tareas son relativas a ese subdirectorio salvo indicación contraria. La implementación usa **TypeScript** (Next.js 15 App Router, TS strict, Tailwind v4 + tokens CSS, shadcn/ui, React Query, Zustand, next-intl, sonner, lucide-react, date-fns, Zod).

> Nota: por decisión del usuario, este plan **no incluye tareas de pruebas** (ni unitarias, ni de integración, ni basadas en propiedades). La sección "Correctness Properties" y "Testing Strategy" del diseño no se traduce en tareas. La calidad se asegura con una implementación completa y una verificación final de build y tipos.

## Tasks

- [x] 1. Setup: dependencia, variable de entorno, migración y tipos
  - [x] 1.1 Instalar `resend` y declarar `RESEND_API_KEY` en `.env.example`
    - Ejecutar `npm install resend` con `cwd` en `cta-graduados/` (confirmar que `@upstash/ratelimit` y `@upstash/redis` ya están instalados; no reinstalarlos)
    - Añadir la entrada `RESEND_API_KEY=` con un valor marcador de posición que NO sea una clave válida ni operativa (por ejemplo `RESEND_API_KEY=re_placeholder_no_valida`) en `.env.example`
    - La clave es solo-servidor: sin prefijo `NEXT_PUBLIC_`, sin valores literales en código fuente
    - _Requisitos: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Crear y aplicar la migración `053_email_notifications.sql`
    - Crear el archivo `supabase/migrations/053_email_notifications.sql` (siguiente a la 052, numeración verificada)
    - Tabla `email_plantillas`: `id` uuid PK (`DEFAULT uuid_generate_v4()`), `user_id` uuid NOT NULL FK→`profiles(id)` ON DELETE CASCADE, `tipo` `tipo_notificacion` NOT NULL, `asunto` text NOT NULL CHECK longitud 1–200, `cuerpo_html` text NOT NULL CHECK no vacío, `created_at`/`updated_at` timestamptz NOT NULL DEFAULT now() con trigger `update_updated_at`; UNIQUE `(user_id, tipo)`; índice `idx_email_plantillas_user` en `user_id`
    - Tabla `email_envios`: `id` uuid PK, `originador_id` uuid NOT NULL FK→`profiles(id)` ON DELETE CASCADE, `destinatario_id` uuid NOT NULL FK→`profiles(id)` ON DELETE CASCADE, `tipo` `tipo_notificacion` NOT NULL, `resultado` text NOT NULL CHECK ∈ {`enviado`,`fallo`,`omitido_sin_clave`,`omitido_destinatario`,`omitido_rate_limit`}, `motivo` text, `horario_id` uuid FK→`horarios(id)` ON DELETE SET NULL, `evento_id` text NOT NULL, `created_at` timestamptz NOT NULL DEFAULT now(); restricción única parcial `UNIQUE (evento_id, destinatario_id) WHERE resultado = 'enviado'`; índices `idx_email_envios_horario`, `idx_email_envios_originador`, `idx_email_envios_destinatario`
    - RLS `email_plantillas`: profesor/admin gestionan filas propias (`user_id = auth.uid()`); alumno sin políticas (sin acceso)
    - RLS `email_envios`: admin SELECT todo; profesor SELECT donde `originador_id = auth.uid()` o `destinatario_id = auth.uid()`; alumno SELECT solo donde `destinatario_id = auth.uid()` o `originador_id = auth.uid()`; INSERT vía servidor con `createAdminClient()` (bypass RLS), sin política de INSERT para roles
    - Hacer la migración idempotente: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, políticas envueltas en `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = ...) THEN CREATE POLICY ...; END IF; END $$;`, restricciones únicas con guarda condicional; NO alterar el enum `tipo_notificacion` (los 4 tipos ya existen)
    - Aplicar la migración con la herramienta MCP `mcp_supabase_apply_migration` (además del archivo local)
    - _Requisitos: 7.2, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 16.8_

  - [x] 1.3 Actualizar manualmente `lib/supabase/types.ts`
    - Añadir `email_plantillas` y `email_envios` a `Database['public']['Tables']` con sus `Row`/`Insert`/`Update`/`Relationships`, coherentes con el esquema de la migración 053
    - Añadir alias exportados `export type EmailPlantilla = Tables<'email_plantillas'>;` y `export type EmailEnvio = Tables<'email_envios'>;`
    - NO usar la generación automática de tipos (rompe la app); editar el archivo a mano
    - _Requisitos: 11.3, 11.4_

- [x] 2. Núcleo de `lib/email/`: tipos, cliente, verificador y variables
  - [x] 2.1 Crear `lib/email/types.ts`
    - Definir `TipoCorreo` (`confirmacion` | `cancelacion` | `solicitud_cambio_horario` | `programa_asignado`), `ResultadoEnvio`, `IdiomaCorreo` (`es` | `en`)
    - Definir `VariablesCorreo` (incluye variables comunes y las específicas de `solicitud_cambio_horario`: `fecha_propuesta`, `hora_inicio_propuesta`, `hora_fin_propuesta`, `nota_alumno`)
    - Definir `SolicitudCorreo` (con `tipo`, `originadorId`, `destinatarioId`, `destinatarioEmail`, `destinatarioIdioma`, `variables`, `horarioId?`, `eventoId` y el campo opcional `plantillaOwnerId`) y `ContenidoPlantilla` (`asunto`, `cuerpoHtml`)
    - _Requisitos: 3.1, 8.4, 10.2, 15.5, 16.8_

  - [x] 2.2 Implementar `lib/email/resendClient.ts`
    - Inicialización perezosa análoga a `lib/utils/rateLimit.ts`: leer `process.env.RESEND_API_KEY`, aplicar `trim()`, tratar ausente/vacío/solo-espacios como no configurada
    - Exportar `isEmailEnabled(): boolean` y `getResendClient(): Resend | null` (construye el cliente solo si hay clave válida)
    - _Requisitos: 1.1, 1.2, 1.4, 1.5, 12.1, 12.2_

  - [x] 2.3 Implementar `lib/email/recipientVerifier.ts`
    - Implementar `verificarDestinatario(email)` que devuelve `{ entregable: true }` o `{ entregable: false; motivo: 'formato_invalido' | 'dominio_marca' }`
    - Validar formato: exactamente un `@`, parte local no vacía, dominio con al menos un punto separando dos etiquetas no vacías
    - Extraer el dominio tras el `@`, normalizar a minúsculas y compararlo contra `tenantConfig.emailDomain` (igualdad o terminación en `.` + dominio de marca)
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 12.3_

  - [x] 2.4 Implementar `lib/email/variables.ts`
    - Implementar `variablesDisponibles(tipo): DefinicionVariable[]` (cada variable con `token` y `claveDescripcion` i18n); incluir como mínimo nombre del destinatario, nombre del alumno, título de clase, fecha, `{hora_inicio}`, `{hora_fin}`, `{enlace_clase}`; para `solicitud_cambio_horario` añadir `{fecha_propuesta}`, `{hora_inicio_propuesta}`, `{hora_fin_propuesta}`, `{nota_alumno}`
    - Implementar `sustituirVariables(plantilla, valores)`: reemplaza todas las apariciones de cada token conocido; tokens sin valor → cadena vacía; tokens no presentes no se insertan
    - _Requisitos: 8.1, 8.3, 8.4, 8.5, 9.2, 9.3, 9.4, 15.5_

- [x] 3. Plantillas por defecto (`lib/email/templates/`)
  - [x] 3.1 Implementar `layout.ts` y las 4 plantillas por tipo e idioma
    - Crear `templates/layout.ts` con el envoltorio HTML común (cabecera con `tenantConfig.nombre`, pie)
    - Crear `templates/confirmacion.ts`, `templates/cancelacion.ts`, `templates/solicitudCambioHorario.ts`, `templates/programaAsignado.ts`, cada una con versión `es` y `en`
    - Cada plantilla incluye `{nombre_destinatario}`, una descripción textual del evento según su tipo y el nombre del tenant; produce asunto no vacío de 1–200 caracteres y cuerpo HTML no vacío
    - _Requisitos: 3.1, 3.3, 3.4, 3.5_

  - [x] 3.2 Implementar `templates/index.ts` con `getDefaultTemplate` y `normalizarIdioma`
    - `normalizarIdioma(idioma)` devuelve `'es'` o `'en'` para valores soportados y `'es'` para ausente/no soportado
    - `getDefaultTemplate(tipo, idioma)` selecciona la plantilla por tipo e idioma normalizado y devuelve `ContenidoPlantilla`
    - _Requisitos: 3.1, 3.2, 3.5, 3.6_

- [x] 4. Limitador de tasa y orquestador de envío
  - [x] 4.1 Implementar `lib/email/emailRateLimit.ts`
    - Reutilizar el patrón de `lib/utils/rateLimit.ts`: crear el limiter solo si `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` están configurados y la URL empieza con `https://`; en caso contrario degradar a no-op (`allowed: true`); usar `prefix: 'rl:email'`
    - Exportar `checkEmailRateLimitOriginador(originadorId)` (clave `orig:{originadorId}`) y `checkEmailRateLimitDestinatario(email)` (clave `dest:{emailNormalizado}`), con ventanas deslizantes separadas
    - _Requisitos: 16.1, 16.2, 16.3, 16.5, 16.6_

  - [x] 4.2 Implementar `lib/email/emailService.ts` (`sendNotificationEmail`)
    - Implementar el orquestador no bloqueante que NUNCA lanza: cualquier error interno se captura y se traduce a un `Registro_Envio` con resultado `fallo`
    - Secuencia: (1) deduplicación por `(evento_id, destinatario_id)` consultando `email_envios`; (2) disponibilidad — si `!isEmailEnabled()`, `console.warn` server-only + registrar `omitido_sin_clave`; (3) verificación del destinatario — si no entregable, registrar `omitido_destinatario`; (4) límite de tasa originador y destinatario — si excede, registrar `omitido_rate_limit`; (5) construcción — cargar `email_plantillas` por `plantillaOwnerId ?? originadorId` y `tipo`, o `getDefaultTemplate`, aplicar `sustituirVariables`, derivar `from` del tenant (`no-reply@{tenantConfig.emailDomain}`); (6) envío con `Promise.race` contra timeout de 10 s; (7) registrar `enviado` o `fallo`
    - Implementar la escritura de `Registro_Envio` con `createAdminClient()` (bypass RLS); si incluso el registro falla, `console.error` server-only
    - _Requisitos: 1.5, 1.8, 2.6, 3.2, 3.7, 4.5, 5.2, 5.3, 7.3, 10.1, 10.2, 10.3, 15.3, 15.4, 16.4, 16.8_

- [x] 5. Checkpoint - Núcleo del módulo de correo completo
  - Asegurarse de que todo compila y los tipos son consistentes; preguntar al usuario si surgen dudas.

- [x] 6. Backend: flag de disponibilidad en perfil y CRUD de plantillas
  - [x] 6.1 Crear el esquema de validación Zod de plantillas
    - Crear `lib/validations/emailPlantilla.schema.ts` con validación de `asunto` (no vacío, 1–200, rechazando solo-espacios) y `cuerpo_html` (no vacío, rechazando solo-espacios)
    - _Requisitos: 7.6_

  - [x] 6.2 Exponer `email_disponible` en `GET /api/perfil`
    - Añadir `email_disponible: boolean` (= `isEmailEnabled()`) a la respuesta de `app/api/perfil/route.ts`, calculado server-side, sin exponer la clave
    - _Requisitos: 6.2, 6.3_

  - [x] 6.3 Implementar `GET /api/email/plantillas`
    - Crear `app/api/email/plantillas/route.ts` siguiendo el patrón del proyecto (`createClient()` → `auth.getUser()` → fetch `profiles.rol` → checks)
    - Exigir rol profesor/admin (denegar alumno); devolver las plantillas del usuario por tipo fusionadas con los defaults de `getDefaultTemplate`
    - _Requisitos: 6.5, 7.1, 16.7_

  - [x] 6.4 Implementar `PUT` y `DELETE` de `/api/email/plantillas/[tipo]`
    - Crear `app/api/email/plantillas/[tipo]/route.ts` con `PUT` (validación Zod del esquema 6.1, upsert por `(user_id, tipo)`) y `DELETE` (eliminar la fila personalizada → reset a la `Plantilla_Default`)
    - Exigir auth + rol; denegar rol alumno (403) y tipos no permitidos al rol (incluidos `confirmacion`, `cancelacion`, `solicitud_cambio_horario`)
    - _Requisitos: 7.2, 7.3, 7.4, 7.5, 7.6, 15.8, 16.7_

- [x] 7. Integración en los puntos de disparo (envío no bloqueante)
  - [x] 7.1 Disparo en `PATCH /api/asistencia/[id]/route.ts`
    - Tras persistir el cambio y solo cuando `userRol === 'alumno'` y `estado ∈ {confirmado, cancelado}`, construir `SolicitudCorreo` con `tipo` `confirmacion`/`cancelacion`, `originadorId` = alumno, `destinatarioId` = `horario.profesor_id`
    - Cargar email/idioma del profesor con `createAdminClient()` (el alumno no puede leer el perfil del profesor por RLS); `eventoId = asistencia:{id}:{estado}`; `enlace_clase = ${NEXT_PUBLIC_APP_URL}/horarios/{horario_id}`
    - Invocar de forma no bloqueante: `void sendNotificationEmail(...).catch(() => {})`; NO modificar el trigger DB (la notificación realtime se mantiene intacta)
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 9.1, 16.7, 16.8_

  - [x] 7.2 Disparo en `POST /api/programas/[id]/asignar/route.ts`
    - Dentro del loop por alumno, tras crear la notificación realtime, disparar correo `programa_asignado` con `originadorId` = `user.id`, `destinatarioId` = `alumno_id`, `eventoId = asignacion:{programaId}:{alumno_id}`
    - Mantener cada alumno independiente: el disparo va dentro del `try`/`catch` propio del alumno y no interrumpe el loop
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 16.7, 16.8_

  - [x] 7.3 Disparo en `POST /api/solicitudes-cambio/route.ts`
    - Tras crear la solicitud y la notificación realtime, disparar correo `solicitud_cambio_horario` con `originadorId` = `user.id` (alumno), `destinatarioId` = `profesorId` y `plantillaOwnerId` = `profesorId` (la plantilla la posee el profesor propietario, no el originador)
    - Aportar las variables extra `fecha_propuesta`, `hora_inicio_propuesta`, `hora_fin_propuesta`, `nota_alumno`; `eventoId = solicitud:{solicitud.id}`; invocación no bloqueante
    - _Requisitos: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 16.7, 16.8_

- [x] 8. Checkpoint - Backend e integración completos
  - Asegurarse de que todas las rutas compilan y respetan el patrón del proyecto; preguntar al usuario si surgen dudas.

- [x] 9. UI: internacionalización, editor de plantillas y acceso desde perfil
  - [x] 9.1 Añadir el namespace `plantillasCorreo` en `messages/es.json` y `messages/en.json`
    - Añadir todas las claves de texto del editor (títulos, etiquetas de campos, descripciones de variables, botones, toasts de validación) con paridad exacta de claves entre ambos archivos
    - No hardcodear strings visibles
    - _Requisitos: 13.1, 13.2, 13.3_

  - [x] 9.2 Crear la vista del editor `app/(dashboard)/perfil/plantillas-correo/page.tsx`
    - Client component con selector de tipo de correo, campos de `asunto` y `cuerpo`, y panel con `variablesDisponibles(tipo)` y su descripción; al hacer clic en una variable, insertar su token en el campo activo respetando la posición del cursor del input/textarea
    - Botón "Restablecer" (DELETE) y botón "Guardar" con validación de vacíos y feedback `sonner`; usar componentes/estilos existentes (`inputCls`, `SectionTitle`, `Field`, iconos `lucide-react`, tokens `var(--color-...)`)
    - Data fetching con React Query e invalidación de queries tras mutación; guard de ruta: alumno o `email_disponible === false` → redirigir/denegar
    - _Requisitos: 6.4, 6.5, 7.1, 7.6, 8.1, 8.2, 13.1, 13.3_

  - [x] 9.3 Añadir el control de acceso al editor en `app/(dashboard)/perfil/page.tsx`
    - En la sección "Configuración de clases", mostrar el botón que abre el editor solo cuando `isProfesorOrAdmin` y `perfilData.email_disponible === true`; ocultarlo en caso contrario y para rol alumno
    - Usar componentes/estilos existentes y textos vía i18n
    - _Requisitos: 6.1, 6.2, 6.3, 6.4_

- [x] 10. Activación por tenant
  - [x] 10.1 Configurar `RESEND_API_KEY` en los archivos de entorno de tenant
    - Añadir la línea `RESEND_API_KEY=` en `.env.tenant.pregunta-estrategica` con una instrucción/comentario claro de que el usuario debe rellenar su clave real de la cuenta de Resend asociada (`from` derivado de `no-reply@preguntaestrategica.cl`)
    - En `.env.tenant.ctagraduados`, dejar la activación preparada pero sin activar: línea comentada/vacía indicando que es opcional y que añadir la clave habilita el envío sin cambios de código
    - El `from` se deriva de `tenantConfig.emailDomain`; no hardcodear ids de tenant en la lógica de envío
    - _Requisitos: 12.1, 12.2, 14.1, 14.3, 14.4_

- [x] 11. Verificación final de build y tipos
  - [x] 11.1 Ejecutar build y verificación de tipos, y corregir errores
    - Ejecutar `npm run build` con `cwd` en `cta-graduados/` y asegurar que NO queden errores de compilación
    - Revisar los diagnósticos de TypeScript (`tsc`) de los archivos `.ts`/`.tsx` creados o modificados y corregir cualquier error de tipos
    - Iterar hasta que el build y la verificación de tipos pasen sin errores
    - _Requisitos: 11.3, 11.4_

## Ampliación: Requisitos 17–19

- [x] 12. Base para los nuevos tipos de correo (`nueva_clase`, `invitacion_acceso`)
  - [x] 12.1 Migración `054` para el enum y actualización manual de tipos
    - Crear `supabase/migrations/054_invitacion_acceso_enum.sql` con `ALTER TYPE tipo_notificacion ADD VALUE IF NOT EXISTS 'invitacion_acceso';` (idempotente; la migración SOLO hace el ADD VALUE, no usa el valor en la misma transacción)
    - Aplicar la migración con la herramienta MCP `mcp_supabase_apply_migration`
    - Actualizar MANUALMENTE `lib/supabase/types.ts`: añadir `'invitacion_acceso'` al union del enum `tipo_notificacion` en `Database['public']['Enums']` y a la lista del objeto `Constants` (NO usar generación automática)
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 19.9_

  - [x] 12.2 Ampliar `lib/email/types.ts` y `lib/email/variables.ts`
    - En `lib/email/types.ts`: ampliar `TipoCorreo` con `'nueva_clase'` y `'invitacion_acceso'` (mediante `Extract<TipoNotificacion, ...>`); añadir a `VariablesCorreo` los campos opcionales `enlace_acceso?: string` y `email_acceso?: string`
    - En `lib/email/variables.ts`: añadir `CLAVES_INVITACION = ['enlace_acceso','email_acceso']`; incorporarlas a `CLAVES_CONOCIDAS`; en `variablesDisponibles`, para `invitacion_acceso` devolver `{nombre_destinatario, enlace_acceso, email_acceso}` y para `nueva_clase` devolver las `CLAVES_COMUNES`
    - _Requisitos: 18.9, 19.4_

  - [x] 12.3 Crear plantillas por defecto `nueva_clase` e `invitacion_acceso` y registrarlas
    - Crear `lib/email/templates/nuevaClase.ts` (es/en, `Record<IdiomaCorreo, ContenidoPlantilla>` con `renderLayout`), dirigida al alumno, con `{titulo_clase}`, `{fecha}`, `{hora_inicio}`, `{hora_fin}` y botón `{enlace_clase}`; asunto 1–200 no vacío, cuerpo HTML no vacío
    - Crear `lib/email/templates/invitacionAcceso.ts` (es/en), formal y completa, que incluya OBLIGATORIAMENTE `{enlace_acceso}` (botón/enlace) y muestre `{email_acceso}` y `{nombre_destinatario}`
    - Registrar ambas en `lib/email/templates/index.ts` (mapa `PLANTILLAS`)
    - Añadir `'nueva_clase'` e `'invitacion_acceso'` a `TIPOS_CORREO` en `lib/validations/emailPlantilla.schema.ts` (queda en 6 tipos)
    - _Requisitos: 18.3, 18.4, 19.5, 19.6_

  - [x] 12.4 Claves i18n de los nuevos tipos y del toggle de vista previa
    - En `messages/es.json` y `messages/en.json` (namespace `plantillasCorreo`, paridad exacta): añadir `tipos.nueva_clase` y `tipos.invitacion_acceso`; descripciones `variables.enlace_acceso` y `variables.email_acceso`; y las claves del toggle de vista previa (`cuerpo.modoLabel`, `cuerpo.modoEditor`, `cuerpo.modoPreview` o equivalentes)
    - _Requisitos: 13.1, 13.2, 13.3, 17.5, 18.10, 19.10_

- [x] 13. Vista previa del cuerpo en el editor de plantillas
  - [x] 13.1 Añadir toggle editor/vista previa en `app/(dashboard)/perfil/plantillas-correo/page.tsx`
    - Añadir estado `modoCuerpo: 'editor' | 'preview'` (default `'editor'`); control de alternancia (dos botones) encima del campo de cuerpo con `aria-pressed` y textos i18n
    - En `'editor'` renderizar el `<textarea>` actual (refs de inserción de variables intactas); en `'preview'` renderizar un contenedor con `dangerouslySetInnerHTML={{ __html: cuerpoHtml }}`
    - Alternar NO debe descartar el contenido editado (`cuerpoHtml` no se muta en el toggle)
    - _Requisitos: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 14. Disparo de correo `nueva_clase` al crear una clase singular
  - [x] 14.1 Disparo en `POST /api/horarios/route.ts`
    - Tras insertar el horario y la asistencia, disparo fire-and-forget `void (async () => { ... })().catch(() => {})`
    - Cargar email/idioma/nombre del alumno (`body.alumno_id`) con `createAdminClient()`; construir `SolicitudCorreo` tipo `nueva_clase`, `originadorId` = `profesorId` (creador), `destinatarioId` = `body.alumno_id`
    - Variables: `nombre_destinatario`/`nombre_alumno` = nombre del alumno, `titulo_clase`, `fecha`, `hora_inicio`, `hora_fin`, `enlace_clase = ${NEXT_PUBLIC_APP_URL}/horarios/${horario.id}`; `horarioId = horario.id`; `eventoId = nueva_clase:${horario.id}`
    - La respuesta de creación NO espera al correo; un fallo no revierte el horario
    - _Requisitos: 18.1, 18.2, 18.3, 18.5, 18.6, 18.7, 18.8, 18.9, 18.11_

- [x] 15. Disparo de correo `invitacion_acceso` al crear usuarios
  - [x] 15.1 Disparo en las tres rutas de creación de usuario
    - En `app/api/admin/alumnos/route.ts`, `app/api/admin/profesores/route.ts` y `app/api/profesor/alumnos/route.ts` (POST): tras crear el usuario, su perfil y la fila en `invitations` (usar la variable `code` directamente, disponible en ambos modos), disparar fire-and-forget
    - Construir `SolicitudCorreo` tipo `invitacion_acceso`, `originadorId` = `user.id` (creador), `destinatarioId` = `newUser.user.id`, `destinatarioEmail` = `finalEmail`, `destinatarioIdioma` = `null`
    - Variables: `nombre_destinatario` = nombre+apellido del creado, `enlace_acceso = ${NEXT_PUBLIC_APP_URL}/setup/${code}`, `email_acceso = finalEmail`; `horarioId = null`; `eventoId = invitacion:${newUser.user.id}`
    - La verificación de destinatario descarta automáticamente correos del dominio de marca (`useAppEmail`); la respuesta de creación NO espera al correo; un fallo no revierte la creación
    - _Requisitos: 19.1, 19.2, 19.3, 19.7, 19.8, 19.11_

- [x] 16. Verificación final de build y tipos (ampliación)
  - [x] 16.1 Ejecutar build y verificación de tipos, y corregir errores
    - Ejecutar `npm run build` con `cwd` en `cta-graduados/` y asegurar que NO queden errores de compilación ni de tipos
    - Revisar los diagnósticos de los archivos `.ts`/`.tsx` creados o modificados en las tareas 12–15 y corregir cualquier error
    - Iterar hasta que el build y la verificación de tipos pasen sin errores
    - _Requisitos: 11.3, 11.4_

## Notes

- Por decisión del usuario, este plan NO contiene tareas de testing; las propiedades de correctitud del diseño no se traducen en tareas de prueba.
- Cada tarea referencia los sub-requisitos concretos que cubre, para trazabilidad.
- Los checkpoints aseguran validación incremental antes de avanzar de fase.
- Todo el módulo `lib/email/` es solo-servidor; `RESEND_API_KEY` y el cliente admin nunca se exponen al cliente.
- La migración 053 es idempotente y se aplica tanto como archivo local como vía MCP de Supabase; `lib/supabase/types.ts` se mantiene manualmente.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.3", "4.1", "6.1", "9.1", "10.1"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.4", "3.1", "6.2"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["4.2", "6.3", "6.4"] },
    { "id": 5, "tasks": ["7.1", "7.2", "7.3", "9.2", "9.3"] },
    { "id": 6, "tasks": ["11.1"] }
  ]
}
```
