'use client';

import { useCallback, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { CalendarioProfesor } from '@/components/calendario/CalendarioProfesor';
import { useUser } from '@/lib/hooks/useUser';

export default function ProfesorAgendaPage() {
  const { user } = useUser();
  const [newClassTrigger, setNewClassTrigger] = useState(0);
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
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setNewClassTrigger((n) => n + 1)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nueva clase
        </Button>
      </div>
      <CalendarioProfesor
        profesorId={user.id}
        openNewClassTrigger={newClassTrigger}
        openHorarioId={openHorarioId}
        onHorarioOpened={handleHorarioOpened}
      />
    </div>
  );
}
