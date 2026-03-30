import { QueryClient, dehydrate } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/server';
import type { UserRol } from '@/lib/supabase/types';

const STALE_ADMIN_LISTS = 5 * 60 * 1000; // 5 min — alumnos/profesores lists rarely change
const STALE_HORARIOS = 30_000;            // 30 s — same as app default

/**
 * Create a pre-populated QueryClient for the given user role and return
 * the dehydrated state so HydrationBoundary can seed the client-side cache.
 */
export async function prefetchDashboardData(userId: string, rol: UserRol) {
  const queryClient = new QueryClient();
  const supabase = await createClient();

  if (rol === 'admin') {
    await Promise.allSettled([
      // Stats card
      queryClient.prefetchQuery({
        queryKey: ['admin-stats'],
        queryFn: async () => {
          const { data } = await supabase.rpc('get_admin_stats');
          return {
            total_alumnos: data?.total_alumnos ?? 0,
            total_profesores: data?.total_profesores ?? 0,
            clases_hoy: data?.clases_hoy ?? 0,
            pendientes: data?.pendientes_confirmar ?? 0,
          };
        },
        staleTime: 60_000,
      }),

      // Alumnos + profesores in one SP round-trip
      queryClient.prefetchQuery({
        queryKey: ['admin-init'],
        queryFn: async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any).rpc('get_admin_init_data');
          return data as { alumnos: unknown[]; profesores: unknown[] } | null;
        },
        staleTime: STALE_ADMIN_LISTS,
      }),

      // Recent notifications for dashboard widget
      queryClient.prefetchQuery({
        queryKey: ['admin-notificaciones-dash'],
        queryFn: async () => {
          const { data } = await supabase
            .from('notificaciones')
            .select(
              `*, horario:horarios!notificaciones_horario_id_fkey(id, fecha, hora_inicio, hora_fin),
               alumno:profiles!notificaciones_alumno_id_fkey(id, nombre, apellido),
               destinatario:profiles!notificaciones_destinatario_id_fkey(id, nombre, apellido, rol)`,
            )
            .order('created_at', { ascending: false })
            .limit(10);
          return data ?? [];
        },
        staleTime: 30_000,
      }),

      // Today's classes
      queryClient.prefetchQuery({
        queryKey: ['admin-clases-hoy'],
        queryFn: async () => {
          const today = new Date().toISOString().split('T')[0];
          const { data } = await supabase
            .from('horarios')
            .select(
              `*, alumno:profiles!horarios_alumno_id_fkey(nombre,apellido),
               profesor:profiles!horarios_profesor_id_fkey(nombre,apellido),
               asistencia:asistencia!asistencia_horario_id_fkey(estado)`,
            )
            .eq('fecha', today)
            .eq('activo', true)
            .order('hora_inicio');
          return data ?? [];
        },
        staleTime: 60_000,
      }),
    ]);

    // Seed individual list keys from the batched SP result so those pages
    // show instantly without a separate fetch
    const initData = queryClient.getQueryData<{ alumnos: unknown[]; profesores: unknown[] }>(['admin-init']);
    if (initData) {
      queryClient.setQueryData(['admin-alumnos'], initData.alumnos, { updatedAt: Date.now() });
      queryClient.setQueryData(['admin-profesores'], initData.profesores, { updatedAt: Date.now() });
    }
  }

  if (rol === 'profesor') {
    // Need assigned alumno IDs first to seed 'mis-alumnos' tab without a separate round-trip
    const { data: extras } = await supabase
      .from('alumnos_extra')
      .select('alumno_id')
      .eq('profesor_id', userId);
    const alumnoIds = extras?.map((e) => e.alumno_id) ?? [];

    await Promise.allSettled([
      // SP: horarios (calendar/table) + weekly stats + alumnos list
      queryClient.prefetchQuery({
        queryKey: ['horarios', userId],
        queryFn: async () => {
          const { data } = await supabase.rpc('get_profesor_dashboard', { p_profesor_id: userId });
          return data;
        },
        staleTime: STALE_HORARIOS,
      }),

      // Mis-alumnos page (default tab is 'mis')
      alumnoIds.length > 0
        ? queryClient.prefetchQuery({
            queryKey: ['alumnos', 'mis'],
            queryFn: async () => {
              const { data } = await supabase
                .from('profiles')
                .select('*, alumnos_extra!alumnos_extra_alumno_id_fkey(*)')
                .eq('rol', 'alumno')
                .eq('activo', true)
                .in('id', alumnoIds)
                .order('nombre', { ascending: true });
              return data ?? [];
            },
            staleTime: STALE_ADMIN_LISTS,
          })
        : Promise.resolve(queryClient.setQueryData(['alumnos', 'mis'], [])),
    ]);
  }

  if (rol === 'alumno') {
    await Promise.allSettled([
      // SP: clases + proxima_clase + stats — matches useAsistencia queryKey ['asistencia', id]
      queryClient.prefetchQuery({
        queryKey: ['asistencia', userId],
        queryFn: async () => {
          const { data } = await supabase.rpc('get_alumno_dashboard', { p_alumno_id: userId });
          return data;
        },
        staleTime: STALE_HORARIOS,
      }),
    ]);
  }

  return dehydrate(queryClient);
}
