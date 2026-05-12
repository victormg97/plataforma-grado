'use client';

import { NotificacionesFullView } from '@/components/notificaciones/NotificacionesFullView';

export default function AlumnoNotificacionesPage() {
  return (
    <div className="pt-[var(--space-md)]">
      <NotificacionesFullView role="alumno" />
    </div>
  );
}
