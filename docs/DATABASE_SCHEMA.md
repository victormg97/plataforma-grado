# Database Schema — CTA Graduados

See `supabase/migrations/001_initial_schema.sql` for the full SQL schema.

## Tables

- **profiles** — User profiles extending Supabase auth.users
- **alumnos_extra** — Extended student info (university, notes, graduation status)
- **horarios** — Class schedule blocks
- **asistencia** — Attendance confirmation per schedule
- **notificaciones** — Notifications for professors/admin

## Enums

- `user_rol`: admin, profesor, alumno
- `estado_asistencia`: pendiente, confirmado, cancelado, cambiado
- `tipo_notificacion`: confirmacion, cancelacion, cambio_horario
