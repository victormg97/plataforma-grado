'use client';

import { NotificacionesFullView } from '@/components/notificaciones/NotificacionesFullView';

export default function ProfesorNotificacionesPage() {
  return (
    <div className="pt-[var(--space-md)]">
      <NotificacionesFullView role="profesor" />
    </div>
  );
}
