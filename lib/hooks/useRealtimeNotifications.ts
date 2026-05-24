'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { TipoNotificacion } from '@/lib/supabase/types';

export function useRealtimeNotifications(userId: string | undefined) {
  const t = useTranslations('notificaciones');
  const queryClient = useQueryClient();

  // Use a ref so the channel effect only depends on userId (stable primitive),
  // not on `t` which may return a new reference each render in next-intl.
  const tRef = useRef(t);
  // eslint-disable-next-line react-hooks/refs
  tRef.current = t;

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Subscribe to new notifications inserted for this user.
    // Using notificaciones INSERT (simple RLS: destinatario_id = auth.uid()) is more
    // reliable than asistencia UPDATE, which requires a complex EXISTS subquery that
    // Supabase Realtime doesn't support for row-level filtering.
    const channel = supabase
      .channel(`notif-user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `destinatario_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as { mensaje: string; tipo: TipoNotificacion };
          if (notif?.tipo || notif?.mensaje) {
            const translated = notif?.tipo ? tRef.current(`tipos.${notif.tipo}`) : '';
            toast.info(translated || notif.mensaje, { duration: 6000 });
            queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
