# CTA Graduados

Plataforma web para la gestión de horarios, asistencia y seguimiento de alumnos del estudio **Carlos Toro Araya** — preparación para exámenes de grado en Derecho.

---

## ¿Qué es esta aplicación?

CTA Graduados conecta al profesor con sus alumnos para coordinar clases de forma simple y elegante:

- Los alumnos **confirman, cancelan o cambian** su asistencia a clases.
- El profesor **visualiza en tiempo real** quién asiste y puede planificar en consecuencia.
- El administrador **gestiona profesores, alumnos y horarios** desde un panel central.
- Las notificaciones llegan **en tiempo real** sin necesidad de recargar la página.

---

## Roles

| Rol | Descripción |
|---|---|
| `admin` | Acceso total: gestión de profesores, alumnos y horarios globales |
| `profesor` | Ve sus alumnos y gestiona sus propios horarios |
| `alumno` | Ve sus clases, confirma asistencia y solicita cambios de horario |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript (strict) |
| Estilos | Tailwind CSS v4 |
| Componentes UI | shadcn/ui + Radix UI |
| Base de datos | Supabase (PostgreSQL + Auth + Realtime) |
| Calendario | FullCalendar React |
| Formularios | react-hook-form + Zod |
| Estado global | Zustand |
| Fetching | TanStack React Query |
| Notificaciones | Sonner |
| i18n | next-intl |
| Temas | next-themes (dark/light) |
| Deploy | Vercel |

---

## Estructura de rutas

```
/                        → Redirección automática según rol
/login                   → Autenticación (público)

/admin                   → Dashboard admin (calendario global)
/admin/profesores        → Gestión de profesores
/admin/alumnos           → Gestión global de alumnos

/profesor                → Dashboard del profesor (calendario + notificaciones)
/profesor/mis-alumnos    → Lista de alumnos asignados + ficha individual
/profesor/horarios       → Crear y gestionar horarios

/alumno                  → Panel del alumno (próxima clase + estado)
/alumno/horario          → Confirmar, cancelar o pedir cambio de horario
```

---

## Instalación local

### Prerrequisitos

- Node.js 18+
- Cuenta de Supabase con el proyecto configurado

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/cta-graduados.git
cd cta-graduados

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus keys de Supabase

# 4. Correr en desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # Solo server-side
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Base de datos

Las migraciones se encuentran en `supabase/migrations/` y deben ejecutarse en orden desde el SQL Editor de Supabase:

| Archivo | Descripción |
|---|---|
| `001_initial_schema.sql` | Tablas principales: `profiles`, `alumnos_extra`, `horarios`, `asistencia`, `notificaciones` |
| `002_enable_realtime.sql` | Habilita Realtime en `asistencia` y `notificaciones` |
| `003_notification_trigger.sql` | Trigger automático de notificaciones al cambiar estado de asistencia |
| `004_avatars_storage.sql` | Bucket de Storage para fotos de perfil |

---

## Funcionalidades destacadas

### Calendario interactivo
Vista mensual/semanal con FullCalendar. Los eventos se colorean según el estado de asistencia (`confirmado`, `pendiente`, `cancelado`, `cambiado`).

### Notificaciones en tiempo real
Supabase Realtime escucha cambios en la tabla `notificaciones`. El badge de la campana en la navbar se actualiza sin recargar.

### URLs persistentes
Todo el estado relevante de UI vive en la URL (query params). Al presionar F5 el usuario vuelve exactamente al mismo estado.

### Badge de graduado 🎓
Cuando `alumnos_extra.paso_prueba = true`, el alumno aparece con un borde dorado animado y badge especial en toda la app.

### Dark mode
Soporte completo dark/light con `next-themes`. Los tokens de color están definidos en `app/globals.css`.

---

## Comandos útiles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run lint     # Lint del proyecto
```

---

## Deploy

La aplicación está configurada para deploy en **Vercel** con conexión directa a Supabase.

Variables de entorno que deben configurarse en Vercel → Settings → Environment Variables:

| Variable | Entorno |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | Production |

---

## Diseño

La identidad visual de CTA Graduados usa:

- **Colores:** negro `#1a1a1a`, blanco `#FFFFFF`, dorado `#C9993F`
- **Tipografía display:** Playfair Display (serif elegante)
- **Tipografía body:** DM Sans (moderna, limpia)
- **Estilo:** Minimalista, profesional, mobile-first

