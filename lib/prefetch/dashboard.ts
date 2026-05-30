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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stats = data as any;
          return {
            total_alumnos: stats?.total_alumnos ?? 0,
            total_profesores: stats?.total_profesores ?? 0,
            clases_hoy: stats?.clases_hoy ?? 0,
            pendientes: stats?.pendientes_confirmar ?? 0,
          };
        },
        staleTime: 60_000,
      }),

      // Alumnos list — uses get_alumnos_admin to include computed estado field
      queryClient.prefetchQuery({
        queryKey: ['admin-alumnos'],
        queryFn: async () => {
          const { data } = await supabase.rpc('get_alumnos_admin', {
            p_q: null,
            p_profesor_id: null,
            p_estado: null,
          });
          return (data ?? []).map((r: Record<string, unknown>) => ({
            id: r.id,
            nombre: r.nombre,
            apellido: r.apellido,
            apellido_materno: r.apellido_materno,
            email: r.email,
            telefono: r.telefono,
            avatar_url: r.avatar_url,
            activo: r.activo,
            estado_cuenta: r.estado === 'pendiente' ? 'Pendiente' : 'Activo',
            estado: r.estado,
            profesor_id: r.profesor_id,
            profesor: r.profesor_id ? { id: r.profesor_id, nombre: r.profesor_nombre, apellido: r.profesor_apellido } : null,
            universidad: r.universidad,
            año_ingreso: r.año_ingreso,
            notas: r.notas,
            paso_prueba: r.paso_prueba ?? false,
            fecha_prueba: r.fecha_prueba,
          }));
        },
        staleTime: STALE_ADMIN_LISTS,
      }),

      // Profesores list — uses get_profesores_admin to include computed estado_cuenta and alumnos_count
      queryClient.prefetchQuery({
        queryKey: ['admin-profesores'],
        queryFn: async () => {
          const { data } = await supabase.rpc('get_profesores_admin');
          return data ?? [];
        },
        staleTime: STALE_ADMIN_LISTS,
      }),

      // Alumnos + profesores batched SP (kept for admin-init consumers)
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

      // Programas (active) — for /admin/programas page
      queryClient.prefetchQuery({
        queryKey: ['programas', 'activo'],
        queryFn: async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any)
            .from('programas')
            .select('*, clases:clases_programa(*)')
            .eq('estado', 'activo')
            .order('created_at', { ascending: false });
          return data ?? [];
        },
        staleTime: STALE_ADMIN_LISTS,
      }),

      // Recursos — for /admin/recursos page
      queryClient.prefetchQuery({
        queryKey: ['recursos', userId],
        queryFn: async () => {
          const { data } = await supabase.rpc('get_recursos_for_user');
          const result = data as { recursos: unknown[]; carpetas: unknown[] } | null;
          return { recursos: result?.recursos ?? [], carpetas: result?.carpetas ?? [] };
        },
        staleTime: 30_000,
      }),
    ]);

    // admin-alumnos and admin-profesores are now prefetched directly above
    // with the correct data shape (including computed estado field)
  }

  if (rol === 'profesor') {
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

      // Mis-alumnos page — uses get_alumnos_profesor to include estado_cuenta
      queryClient.prefetchQuery({
        queryKey: ['alumnos', 'mis'],
        queryFn: async () => {
          const { data } = await supabase.rpc('get_alumnos_profesor', {
            p_profesor_id: userId,
            p_scope: 'mis',
          });
          return (data ?? []).map((r: Record<string, unknown>) => ({
            ...r,
            alumnos_extra: r.alumno_id ? [{
              alumno_id: r.alumno_id,
              profesor_id: r.profesor_id,
              universidad: r.universidad,
              año_ingreso: r.año_ingreso,
              notas: r.notas,
              paso_prueba: r.paso_prueba,
              fecha_prueba: r.fecha_prueba,
              ha_dado_examen: r.ha_dado_examen,
              intentos_prueba: r.intentos_prueba,
            }] : [],
          }));
        },
        staleTime: STALE_ADMIN_LISTS,
      }),

      // Programas (active) — for /profesor/programas page
      queryClient.prefetchQuery({
        queryKey: ['programas', 'activo'],
        queryFn: async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any)
            .from('programas')
            .select('*, clases:clases_programa(*)')
            .eq('estado', 'activo')
            .order('created_at', { ascending: false });
          return data ?? [];
        },
        staleTime: STALE_ADMIN_LISTS,
      }),

      // Recursos — for /profesor/recursos page
      queryClient.prefetchQuery({
        queryKey: ['recursos', userId],
        queryFn: async () => {
          const { data } = await supabase.rpc('get_recursos_for_user');
          const result = data as { recursos: unknown[]; carpetas: unknown[] } | null;
          return { recursos: result?.recursos ?? [], carpetas: result?.carpetas ?? [] };
        },
        staleTime: 30_000,
      }),
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

      // Recursos — for /alumno/recursos page
      queryClient.prefetchQuery({
        queryKey: ['recursos', userId],
        queryFn: async () => {
          const { data } = await supabase.rpc('get_recursos_for_user');
          const result = data as { recursos: unknown[]; carpetas: unknown[] } | null;
          return { recursos: result?.recursos ?? [], carpetas: result?.carpetas ?? [] };
        },
        staleTime: 30_000,
      }),
    ]);
  }

  return dehydrate(queryClient);
}
