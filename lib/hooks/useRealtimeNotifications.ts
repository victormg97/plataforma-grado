'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export function useRealtimeNotifications(userId: string | undefined) {
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
          const notif = payload.new as { mensaje: string; tipo: string };
          if (notif?.mensaje) {
            toast.info(notif.mensaje, { duration: 6000 });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
