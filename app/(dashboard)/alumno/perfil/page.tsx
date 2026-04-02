'use client';

import { useUserStore } from '@/stores/useUserStore';
import { FichaAlumnoPage } from '@/components/alumnos/FichaAlumno/FichaAlumnoPage';

export default function MiPerfilPage() {
  const { user } = useUserStore();

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
      </div>
    );
  }

  return <FichaAlumnoPage alumnoId={user.id} role="alumno" />;
}
