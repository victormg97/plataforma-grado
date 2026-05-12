'use client';

import { NotificacionesFullView } from '@/components/notificaciones/NotificacionesFullView';

export default function AdminNotificacionesPage() {
  return (
    <div className="pt-[var(--space-md)]">
      <NotificacionesFullView role="admin" />
    </div>
  );
}
