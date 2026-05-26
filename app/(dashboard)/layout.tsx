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

  // Block access if account is inactive
  if (!profile.activo) redirect('/login?blocked=1');

  // For alumnos, check graduation status (used for easter-egg theme)
  let esGraduado = false;
  if (profile.rol === 'alumno') {
    const { data: extra } = await supabase
      .from('alumnos_extra')
      .select('paso_prueba')
      .eq('alumno_id', user.id)
      .single();
    esGraduado = extra?.paso_prueba === true;
  }

  // Prefetch role-specific data server-side so the first page renders
  // with data already in the React Query cache (zero loading spinners).
  const dehydratedState = await prefetchDashboardData(user.id, profile.rol);

  return (
    <DashboardLayoutClient profile={profile} esGraduado={esGraduado} dehydratedState={dehydratedState}>
      {children}
    </DashboardLayoutClient>
  );
}
