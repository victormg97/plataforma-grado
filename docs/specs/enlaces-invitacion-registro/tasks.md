# Implementation Plan: Enlaces de invitación y registro

## Overview

Este plan convierte el diseño aprobado en una serie de pasos de codificación incrementales. Cada paso construye sobre el anterior y termina cableando las piezas entre sí, sin dejar código huérfano. El orden es: (1) base de datos y tipos, (2) funciones puras de lógica y validación, (3) endpoints API, (4) vista de gestión, (5) botones de acceso, (6) vista pública de registro, (7) i18n, (8) documentación de Google OAuth y (9) verificación final de compilación.

> **Nota sobre testing:** por decisión explícita del usuario, este plan **no incluye tareas de tests automatizados** (sin tests unitarios, sin property-based testing, sin tests de integración, sin configuración de fast-check/vitest). Las "Correctness Properties" y la "Testing Strategy" del diseño se usan como guía de comportamiento de las funciones de producción, pero **no** se convierten en tareas. La única verificación incluida es la compilación de producción + `tsc` + `lint` (Req 20.6–20.8), que es verificación de build, no testing.

## Tasks

- [ ] 1. Base de datos y tipos
  - [ ] 1.1 Crear migración `066_enlaces_invitacion.sql` idempotente y aplicarla
    - Crear la tabla `public.enlaces_invitacion` con todas las columnas del diseño (`id`, `tenant`, `codigo`, `tipo`, `estado`, `created_by`, `profesor_asignado`, `usuario_creado`, `eliminado`, `deleted_at`, `created_at`, `updated_at`), con FKs `ON DELETE SET NULL` a `profiles`, `CHECK (tipo IN ('profesor','alumno'))`, `UNIQUE(codigo)` y `DEFAULT 'activo'` en `estado`
    - Crear los índices: único de `codigo` e índices de `created_by`, `estado`, `profesor_asignado`, `usuario_creado`
    - Habilitar RLS y crear las políticas: SELECT admin (todo), SELECT profesor (`created_by = auth.uid()`), INSERT (admin cualquiera / profesor habilitado solo `tipo='alumno'` propio), UPDATE admin, DELETE admin; sin políticas para `anon`
    - Garantizar idempotencia con `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` antes del `CHECK`, y bloques `DO $$ ... pg_policies guards ...` para cada política (patrón de las migraciones 033/047)
    - Aplicar la migración en la base de datos del tenant activo vía MCP de Supabase y entregar el archivo versionado en `supabase/migrations/066_enlaces_invitacion.sql`
    - _Requirements: 19.1, 19.4, 19.5, 19.6, 19.7, 19.8, 20.1, 20.2_

  - [ ] 1.2 Actualizar manualmente `lib/supabase/types.ts`
    - Añadir la definición `enlaces_invitacion` (`Row`/`Insert`/`Update`/`Relationships`) dentro de `Database['public']['Tables']`, consistente con las columnas y tipos de la migración 066
    - Exportar el alias `export type EnlaceInvitacion = Tables<'enlaces_invitacion'>;`
    - No usar generación automática de tipos (rompe la app); edición manual exclusivamente
    - _Requirements: 20.3_

- [ ] 2. Funciones puras de lógica de negocio y validación (`lib/enlaces/`, `lib/validations/`)
  - [ ] 2.1 Implementar `lib/enlaces/agrupar.ts`
    - `agruparPorEstado(enlaces)`: agrupa por `estado` en orden de primera aparición, sin grupos vacíos, conservando todos los elementos; expone el recuento por grupo
    - `etiquetaEstado(estado, t)`: etiqueta i18n del estado con fallback legible al propio string
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 7.7, 7.8_

  - [ ] 2.2 Implementar `lib/enlaces/filtrar.ts`
    - `filtrarEnlaces(enlaces, { creador, tipo })`: subconjunto conservando orden; AND de ambos filtros; entrada completa cuando ambos son `null`
    - `opcionesDistintas(enlaces, campo)`: valores distintos presentes en el campo; helper de "deshabilitado" cuando hay menos de 2 valores
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ] 2.3 Implementar `lib/enlaces/compartir.ts`
    - `construirUrlEnlace(base, code)`: une `base` + `/registro/` + `code` con una sola barra de separación y sin barras duplicadas (recorta barras finales de `base` e iniciales de `code`)
    - _Requirements: 9.1_

  - [ ] 2.4 Implementar `lib/enlaces/autorizacion.ts`
    - `authorizeCreate(actor, solicitud)`: admin acepta cualquier `tipo` (`created_by=actor`, `estado='activo'`); profesor habilitado solo `tipo='alumno'` (`created_by=actor`, `profesor_asignado=actor`); cualquier otro caso devuelve rechazo de autorización (sin enlace a crear)
    - `resolverProfesorAsociado(...)`: devuelve el id del profesor si y solo si existe, está activo y tiene rol `profesor`/`admin`; en otro caso `null`
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.8, 3.9, 4.4, 4.5, 4.8, 5.4_

  - [ ] 2.5 Implementar `lib/enlaces/acciones.ts`
    - `transicionEstado(estado, accion)`: `activo`→`deshabilitado` y `deshabilitado`→`activo` (round-trip); habilitar un `usado` siempre rechaza conservando `usado`
    - `accionesDeFila(enlace, rol)`: incluye "deshabilitar" sii `activo`, "habilitar" sii `deshabilitado`, nunca alternar estado si `usado`, e incluye control de navegación al usuario creado sii `usado` y cuenta activa
    - `validarCodigo(enlace)`: válido sii existe, `estado='activo'` y `eliminado=false`
    - `controlNavegacionUsuario(enlace, perfilUsuario)`: `/admin/alumnos/[id]` (alumno activo), `/admin/profesores/[id]/horarios` (profesor activo), `null` si cuenta desactivada/perfil inexistente
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 11.3, 11.4, 11.5, 11.6, 11.7, 13.4, 17.5, 17.6, 18.1, 18.3_

  - [ ] 2.6 Implementar `lib/enlaces/navegacion.ts`
    - `destinoRetorno(rol, from)`: profesor → `/profesor/mis-alumnos`; admin → `from` si es `/admin/profesores` o `/admin/alumnos`, fallback `/admin/profesores`
    - `formatearFechaCreacion(fecha)`: formato `dd/MM/yyyy HH:mm` con `date-fns` (día, mes, año, hora, minuto)
    - _Requirements: 2.2, 2.4, 2.5, 6.1_

  - [ ] 2.7 Implementar esquemas zod y regla de validez en `lib/validations/registro.ts`
    - `registroAlumnoSchema` y `registroProfesorSchema` (campos obligatorios/opcionales por tipo)
    - `registroEsValido(form, tipo)`: verdadera sii todos los obligatorios no vacíos tras `trim`, contraseña 6–128, contraseña == repetir, T&C aceptados (regla compartida cliente/servidor)
    - _Requirements: 14.3, 14.4, 14.7, 14.8, 15.1, 15.2, 15.6, 16.2, 16.5_

- [ ] 3. Endpoints API
  - [ ] 3.1 Implementar `app/api/enlaces-invitacion/route.ts` (GET listar + POST crear)
    - GET con cliente SSR autenticado: devuelve `EnlaceListItem[]` con joins de nombres (creador, profesor asignado, usuario creado), filtrado por RLS y reforzado por chequeo de rol; filtro defensivo por `tenant = NEXT_PUBLIC_TENANT_ID`
    - POST: deriva `created_by` de la sesión, aplica `authorizeCreate` (Tarea 2.4), valida `profesor_asignado` (pertenece a la base y rol `profesor`/`admin`), genera código con `generateShortCode(24)` (≥128 bits), inserta con `estado='activo'` y `tenant`; responde `{id, code}`; en cualquier rechazo (403/422) no persiste nada
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.3, 4.6, 4.7, 5.1, 5.2, 5.4, 6.1, 6.2, 6.3, 11.1, 11.2, 19.4, 19.7_

  - [ ] 3.2 Implementar `app/api/enlaces-invitacion/profesores/route.ts` (GET)
    - Sesión admin: devuelve `{id, nombre, apellido, rol}[]` de perfiles con `rol IN ('profesor','admin')` para poblar el selector de profesor asignado
    - _Requirements: 4.1_

  - [ ] 3.3 Implementar `app/api/enlaces-invitacion/[id]/route.ts` (PATCH + DELETE)
    - PATCH (solo admin): actualizar `profesor_asignado` (solo tipo `alumno` activo) o alternar `estado` con `transicionEstado` (Tarea 2.5); rechazar habilitar un `usado` con `409 ENLACE_USADO`; si no se modifica profesor, conservarlo
    - DELETE (solo admin): soft-delete (`eliminado=true`, `deleted_at=now()`) para invalidar el código
    - Reforzar autorización (profesor no puede mutar) además de RLS; en fallo conservar estado/profesor previos
    - _Requirements: 5.5, 5.6, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.10_

  - [ ] 3.4 Implementar `app/api/registro/validar/route.ts` (GET público, service role)
    - `?code=`: usa `lib/supabase/admin.ts` (service role) para devolver únicamente la fila del código solicitado; aplica `validarCodigo` (Tarea 2.5) y responde `{ valid, tipo? }` sin exponer otros enlaces ni el motivo exacto
    - _Requirements: 13.4, 18.1, 18.3, 19.2, 19.3, 19.5_

  - [ ] 3.5 Implementar `app/api/registro/route.ts` (POST público, service role)
    - Validar entrada con `registroEsValido` (Tarea 2.7) y `validarCodigo` (Tarea 2.5) antes de crear nada; rechazos `422`/`409` sin crear cuenta
    - Crear `auth.users` con service role (metadata `rol` según `tipo`), asociar alumno→profesor con `resolverProfesorAsociado` (Tarea 2.4) si aplica, ejecutar el **claim atómico** (`activo`→`usado` + `usuario_creado`); si el claim devuelve 0 filas, compensar eliminando el usuario recién creado y responder `409 ENLACE_USADO`
    - Establecer sesión (`signInWithPassword` SSR → cookies) y disparar `sendNotificationEmail('invitacion_acceso')` fire-and-forget; responder `{redirectPath}`
    - _Requirements: 4.4, 4.5, 4.8, 14.7, 14.8, 15.6, 16.5, 17.1, 17.2, 17.3, 17.4, 17.6, 17.7, 17.8, 17.9_

  - [ ] 3.6 Implementar `app/api/auth/registro/callback/route.ts` (GET, Google OAuth)
    - Validar `?inv=<codigo>` con `validarCodigo` **antes** de `exchangeCodeForSession` (un código inválido no crea cuenta); tras el intercambio asegurar `rol` del perfil según `tipo`, asociar alumno→profesor, ejecutar el claim atómico, disparar correo y redirigir al dashboard
    - Si el claim falla tras el intercambio: cerrar sesión y eliminar el usuario creado por este flujo; cancelación/fallo de Google → redirigir a `/registro/[code]?error=google`
    - _Requirements: 13.2, 13.4, 13.5, 13.6, 17.1, 17.2, 17.3, 17.4, 17.7, 17.9_

- [ ] 4. Vista de gestión `/enlaces-invitacion`
  - [ ] 4.1 Implementar `components/enlaces/ModalCrearEnlace.tsx`
    - Componente común `Modal`; selector de `Tipo_Enlace` con `AppSelect` (fijo en `alumno` para profesor habilitado); si `alumno`, selector de profesor asignado poblado desde `GET /api/enlaces-invitacion/profesores` con opción "Sin profesor asignado"; envía `POST /api/enlaces-invitacion`
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.6, 5.4_

  - [ ] 4.2 Implementar `components/enlaces/ModalEditarEnlace.tsx`
    - `Modal` para editar el `profesor_asignado` de un enlace `alumno` `activo`; envía `PATCH /api/enlaces-invitacion/[id]`; conserva el valor si no se modifica
    - _Requirements: 8.6, 8.7_

  - [ ] 4.3 Implementar `components/enlaces/GrupoEstado.tsx`
    - Renderiza un grupo de estado con el componente común `Collapsible` (`defaultOpen={false}`), título = `etiquetaEstado` + recuento y `badge` = nº de items, usando `agruparPorEstado` (Tarea 2.1)
    - _Requirements: 7.4, 7.5, 7.8_

  - [ ] 4.4 Implementar `components/enlaces/FilaEnlace.tsx`
    - Muestra creador, fecha (`formatearFechaCreacion`), `StatusBadge` de estado, tipo, profesor asignado o indicador de ausencia, y usuario creado o "no disponible"; acciones con `CardActions` construidas con `accionesDeFila` (Tarea 2.5): editar, compartir, alternar estado, eliminar (`ConfirmDeleteModal`) y navegar al usuario creado con `controlNavegacionUsuario`
    - _Requirements: 6.1, 6.2, 6.3, 8.1, 8.2, 8.3, 8.4, 8.8, 8.9, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ] 4.5 Implementar `components/enlaces/BotonCompartir.tsx`
    - Construye la URL con `construirUrlEnlace` (Tarea 2.3), copia con `navigator.clipboard.writeText`, muestra popover "Copiado" con elemento nativo posicionado y `setTimeout` de 2000 ms reiniciable; en fallo muestra `toast.error` sin popover y sin tocar el portapapeles
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

  - [ ] 4.6 Implementar `components/enlaces/FiltrosEnlaces.tsx`
    - Controles `AppSelect` de Creador y Tipo poblados con `opcionesDistintas` (Tarea 2.2), deshabilitados con menos de 2 valores; aplica `filtrarEnlaces` con `useMemo`
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.8_

  - [ ] 4.7 Implementar `app/(dashboard)/enlaces-invitacion/page.tsx` y cablear la vista
    - Control de acceso con `useUser()`: si no es admin ni profesor con `puede_crear_alumno`, redirigir a `getRolRedirectPath(rol)` sin renderizar enlaces
    - `PageHeader` + `BackButton` usando `destinoRetorno(rol, from)` (Tarea 2.6) leyendo `?from=`; botón "Crear enlace" que abre `ModalCrearEnlace`
    - Cargar datos con React Query (`GET /api/enlaces-invitacion`), aplicar filtros (4.6) y agrupación (4.3) con `useMemo`, renderizar filas (4.4), modales (4.1, 4.2) y compartir (4.5); invalidar la query tras cada mutación; mostrar mensajes de listado vacío y de "sin coincidencias"
    - _Requirements: 1.5, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 6.4, 6.5, 7.1, 7.6, 7.7, 8.10, 10.4, 10.9_

- [ ] 5. Botones "Enlace invitación" en las vistas de origen
  - [ ] 5.1 Añadir el botón en `app/(dashboard)/admin/profesores/page.tsx`
    - Componente común `Button` en `PageHeader.actions`, junto a "Agregar profesor", que navega a `/enlaces-invitacion?from=/admin/profesores`
    - _Requirements: 1.1, 1.6_

  - [ ] 5.2 Añadir el botón en `app/(dashboard)/admin/alumnos/page.tsx`
    - `Button` junto a "Agregar alumno" que navega a `/enlaces-invitacion?from=/admin/alumnos`
    - _Requirements: 1.2, 1.6_

  - [ ] 5.3 Añadir el botón en `app/(dashboard)/profesor/mis-alumnos/page.tsx`
    - `Button` junto a "Agregar alumno", visible solo si `user?.puede_crear_alumno`, que navega a `/enlaces-invitacion`
    - _Requirements: 1.3, 1.4, 1.6_

- [ ] 6. Vista pública de registro `/registro/[code]`
  - [ ] 6.1 Extraer el bloque T&C a `components/auth/TerminosAceptacion.tsx` y refactorizar `setup/[code]`
    - Mover el modal + checkbox + carga de `/api/legal/terminos` (actualmente inline en `app/(auth)/setup/[code]/page.tsx`) a un componente compartido; refactorizar `setup/[code]` para usarlo; manejar el caso sin T&C configurados con error conservando la vista
    - _Requirements: 16.1, 16.3, 16.4_

  - [ ] 6.2 Implementar `app/registro/layout.tsx`
    - Layout dedicado (fuera de `(auth)`): `AppLogo variant="login"` arriba-izquierda, `WhoWeAre` (se autodesactiva si el tenant no tiene contenido) + `ThemeToggle` arriba-derecha, card centrado con `max-w-lg` (estrictamente mayor que `max-w-md` del login)
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ] 6.3 Implementar `components/registro/BloqueGoogle.tsx`
    - Botón "Registrarse con Google" que invoca `signInWithOAuth` con `redirectTo` a `/api/auth/registro/callback?inv=${code}`, más la línea divisoria "o" entre el bloque Google y el formulario manual
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ] 6.4 Implementar `components/registro/FormularioRegistro.tsx`
    - Campos por tipo (alumno/profesor) con `react-hook-form` + esquemas zod (Tarea 2.7), asteriscos en obligatorios, contraseña y repetir con control de ojo, integración de `TerminosAceptacion` (Tarea 6.1); botón "Crear cuenta" habilitado/deshabilitado según `registroEsValido`; mensajes en línea < 1 s que se retiran al corregir; envía `POST /api/registro`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 15.1, 15.2, 15.3, 15.4, 15.5, 16.2_

  - [ ] 6.5 Implementar `app/registro/[code]/page.tsx` y cablear la vista
    - Validar el código con `GET /api/registro/validar` (React Query); si no es válido, mostrar la ventana de error de enlace no válido reutilizada (icono + mensaje + único botón "Ir a login"); si es válido, renderizar `BloqueGoogle` (6.3) + `FormularioRegistro` (6.4) según `tipo`; manejar `?error=google` mostrando el mensaje de autenticación no completada
    - _Requirements: 12.1, 13.5, 13.6, 18.1, 18.2, 18.3, 18.4_

- [ ] 7. Internacionalización
  - [ ] 7.1 Añadir las cadenas i18n en `messages/es.json`, `messages/en.json` y los namespaces de `messages/pages/`
    - Cadenas de: botón "Enlace invitación", vista de gestión (título, filtros, estados, acciones, mensajes vacíos, popover "copiado"), modales crear/editar, vista de registro (Google, divisor, campos por tipo, contraseña, errores, T&C, ventana de enlace no válido)
    - _Requirements: 1.1, 1.2, 1.3, 6.5, 7.8, 9.2, 10.9, 13.1, 13.5, 13.6, 16.1, 18.1_

- [ ] 8. Documentación de Google OAuth
  - [ ] 8.1 Documentar el procedimiento de configuración de Google OAuth en Supabase
    - Crear un documento (p. ej. `docs/google-oauth-setup.md`) con los pasos por tenant: Google Cloud Console (pantalla de consentimiento, credenciales OAuth web, orígenes y URIs de redirección), habilitar el proveedor Google en Supabase con Client ID/Secret, configurar Site URL y Redirect URLs (`${NEXT_PUBLIC_APP_URL}/api/auth/registro/callback`) y verificar el flujo PKCE; incluir notas de seguridad sobre el Client Secret
    - _Requirements: 13.7_

- [ ] 9. Verificación final de compilación (Vercel)
  - [ ] 9.1 Ejecutar y dejar sin errores el build de producción, `tsc` y `lint`
    - Ejecutar el build de producción (`next build`), la verificación de tipos (`tsc --noEmit`, incluida la consistencia de `lib/supabase/types.ts`) y el `lint`; corregir cualquier error hasta que las tres pasen sin errores
    - _Requirements: 20.6, 20.7, 20.8_

## Notes

- Cada tarea referencia los requisitos que cubre para trazabilidad.
- La estructura es incremental: BD/tipos → funciones puras → endpoints → vista de gestión → botones → vista pública → i18n → documentación → verificación de build.
- Las funciones puras (`lib/enlaces/`, `lib/validations/`) implementan el comportamiento descrito en las "Correctness Properties" del diseño como código de producción; **no se generan tests** por decisión del usuario.
- El service role (`lib/supabase/admin.ts`) se usa exclusivamente en route handlers del servidor (validación pública y consumo del enlace); nunca se expone al cliente.
- La tarea 9.1 es verificación de compilación (build + tsc + lint), no testing automatizado.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "6.1", "6.2", "8.1"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "6.3", "6.4"] },
    { "id": 3, "tasks": ["4.7", "6.5"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "7.1"] },
    { "id": 5, "tasks": ["9.1"] }
  ]
}
```
