'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';

/**
 * Returns the current user from the Zustand store (pre-seeded by DashboardLayoutClient).
 * Also watches for SIGNED_OUT events so the app redirects when the session expires.
 */
export function useUser() {
  const { user, clearUser } = useUserStore();

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearUser();
        window.location.href = '/login';
      }
    });

    return () => subscription.unsubscribe();
  }, [clearUser]);

  return { user, loading: false };
}

