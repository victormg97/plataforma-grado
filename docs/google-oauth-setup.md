# Configuración de Google OAuth en Supabase

Esta guía describe cómo habilitar el registro con Google para la vista pública de
registro (`/registro/[code]`). Debe repetirse **por cada tenant**, ya que cada
tenant tiene su propio proyecto de Supabase.

> El registro con Google es opcional: si el proveedor no está configurado, el
> botón "Registrarse con Google" mostrará un error de Supabase al usarse, pero el
> registro manual seguirá funcionando con normalidad.

## 1. Crear las credenciales en Google Cloud Console

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea o
   selecciona un proyecto.
2. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo**.
   - Completa el nombre de la app, el correo de soporte y el dominio.
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - **Orígenes de JavaScript autorizados**: la URL base de la app del tenant
     (el valor de `NEXT_PUBLIC_APP_URL`, por ejemplo `https://mi-tenant.dominio.cl`).
   - **URIs de redirección autorizados**: la URL de callback que muestra Supabase
     en el panel del proveedor de Google, con el formato:
     `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Guarda y copia el **Client ID** y el **Client Secret**.

## 2. Habilitar el proveedor en Supabase

1. En el **Supabase Dashboard** del proyecto del tenant, ve a
   **Authentication → Providers → Google**.
2. Activa el proveedor y pega el **Client ID** y el **Client Secret** del paso
   anterior. Guarda.

## 3. Configurar las URLs de la app

En **Authentication → URL Configuration**:

- **Site URL**: el valor de `NEXT_PUBLIC_APP_URL` del tenant.
- **Redirect URLs**: añade las dos rutas de callback internas de la app:
  - `${NEXT_PUBLIC_APP_URL}/api/auth/registro/callback` (registro por invitación).
  - `${NEXT_PUBLIC_APP_URL}/api/auth/login/callback` (inicio de sesión).

Estas son las rutas que reciben el `?code=` de Supabase. El callback de registro
recibe además el `?inv=<codigo>` del enlace de invitación. El flujo usa **PKCE**
(por defecto en `@supabase/ssr`), de modo que el `code` se intercambia en el
servidor dentro del route handler del callback.

## 3.1. Activar el botón en el tenant

Además de configurar Supabase, debes activar la bandera en el archivo de
configuración del tenant (`config/tenants/<tenant>.ts`) para que aparezcan los
botones de Google (en el login y en la vista de registro):

```ts
auth: { googleHabilitado: true },
```

Si la bandera es `false` o se omite (valor por defecto), los botones de Google no
se muestran en ninguna vista.

## 4. Flujo de seguridad

- El callback (`app/api/auth/registro/callback/route.ts`) **valida el código de
  invitación contra la base de datos ANTES** de completar el registro. Un código
  inválido o ya usado no crea ninguna cuenta.
- El **Client Secret** se guarda solo en Supabase, nunca en el repositorio ni en
  variables `NEXT_PUBLIC_`.
- La variable `SUPABASE_SERVICE_ROLE_KEY` (usada por el servidor para crear la
  cuenta sin sesión previa) tampoco lleva el prefijo `NEXT_PUBLIC_` y nunca se
  expone al cliente.

## 5. Verificación

1. Crea un enlace de invitación desde `/enlaces-invitacion`.
2. Abre el enlace en una ventana sin sesión.
3. Pulsa "Registrarse con Google" y completa el flujo.
4. Verifica que regresas autenticado al dashboard correspondiente (alumno o
   profesor) y que el enlace queda en estado **usado**.
