import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prefetchDashboardData } from '@/lib/prefetch/dashboard';
import { DashboardLayoutClient } from './DashboardLayoutClient';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  // Prefetch role-specific data server-side so the first page renders
  // with data already in the React Query cache (zero loading spinners).
  const dehydratedState = await prefetchDashboardData(user.id, profile.rol);

  return (
    <DashboardLayoutClient profile={profile} dehydratedState={dehydratedState}>
      {children}
    </DashboardLayoutClient>
  );
}
