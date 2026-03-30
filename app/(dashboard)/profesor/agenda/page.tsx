'use client';

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarioProfesor } from '@/components/calendario/CalendarioProfesor';
import { useUser } from '@/lib/hooks/useUser';

export default function ProfesorAgendaPage() {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openHorarioId = searchParams.get('horario');

  const handleHorarioOpened = useCallback(() => {
    router.replace(pathname);
  }, [router, pathname]);

  if (!user) return null;

  return (
    <div className="pt-[var(--space-md)]">
      <CalendarioProfesor
        profesorId={user.id}
        openHorarioId={openHorarioId}
        onHorarioOpened={handleHorarioOpened}
      />
    </div>
  );
}
