'use client';

import { useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications';
import { useUserStore } from '@/stores/useUserStore';
import { HorarioDetailGlobal } from '@/components/horarios/HorarioDetailGlobal';
import type { Profile } from '@/lib/supabase/types';

export function DashboardLayoutClient({
  profile,
  children,
}: {
  profile: Profile;
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

  useRealtimeNotifications(profile.id);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto py-[var(--container-padding)]">
          <div className="container-app">{children}</div>
        </main>
      </div>
      <HorarioDetailGlobal />
    </div>
  );
}
