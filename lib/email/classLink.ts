/**
 * Construcción del Enlace_Clase para los correos (`{enlace_clase}`).
 *
 * La ruta de detalle de una clase depende del ROL del destinatario del correo:
 * - alumno  → `/alumno/horario?id={horarioId}&from=/alumno`
 * - profesor → `/profesor/clase?id={horarioId}`
 * - admin   → `/admin/clase?id={horarioId}`
 *
 * Se construye una URL absoluta con base en `NEXT_PUBLIC_APP_URL`. Esta lógica se
 * centraliza aquí para mantener coherencia con la navegación interna de la app
 * (ver `lib/utils/horarioNavigation.ts`) y evitar enlaces rotos en los correos.
 */

type RolDestinatario = 'alumno' | 'profesor' | 'admin';

/** Base absoluta de la app sin barra final. */
function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
}

/**
 * Devuelve la URL absoluta al detalle de una clase para el rol del destinatario.
 *
 * @param horarioId Identificador del horario/clase.
 * @param rol Rol del destinatario del correo.
 * @returns URL absoluta lista para usarse en la variable `{enlace_clase}`.
 */
export function buildEnlaceClase(horarioId: string, rol: RolDestinatario): string {
  const base = appUrl();

  if (rol === 'alumno') {
    const params = new URLSearchParams({ id: horarioId, from: '/alumno' });
    return `${base}/alumno/horario?${params.toString()}`;
  }

  const basePath = rol === 'admin' ? '/admin/clase' : '/profesor/clase';
  const params = new URLSearchParams({ id: horarioId });
  return `${base}${basePath}?${params.toString()}`;
}
