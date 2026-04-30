'use client';

import { useMemo } from 'react';
import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications';
import { useUserStore } from '@/stores/useUserStore';
import { useThemeSync } from '@/lib/hooks/useThemeSync';
import { HorarioDetailGlobal } from '@/components/horarios/HorarioDetailGlobal';
import type { Profile } from '@/lib/supabase/types';

export function DashboardLayoutClient({
  profile,
  dehydratedState,
  children,
}: {
  profile: Profile;
  dehydratedState: DehydratedState;
  children: React.ReactNode;
}) {
  // Synchronously seed the store before children render so that every
  // component using useUserStore / useUser() sees the correct user on the
  // very first render — no loading spinner, no race condition.
  const setUser = useUserStore((s) => s.setUser);
  useMemo(() => {
    setUser(profile);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // Sync theme with DB (applies profile.tema on mount, saves changes debounced)
  useThemeSync(profile.tema);

  useRealtimeNotifications(profile.id);

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar />
          <main className="flex-1 overflow-y-auto pt-4 pb-[var(--container-padding)]">
            <div className="container-app">{children}</div>
          </main>
        </div>
        <HorarioDetailGlobal />
      </div>
    </HydrationBoundary>
  );
}
