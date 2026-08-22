import { QueryClient, dehydrate } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import type { UserRol } from '@/lib/supabase/types';

/**
 * Create a pre-populated QueryClient for the given user role and return
 * the dehydrated state so HydrationBoundary can seed the client-side cache.
 */
export async function prefetchDashboardData(userId: string, rol: UserRol) {
  const queryClient = new QueryClient();
  const supabase = await createClient();

  // Configuración del sistema de referidos — la consumen el sidebar (para
  // mostrar el botón) y la página de referidos (para saber si el sistema está
  // activo). Se dispara ya para que solape con el prefetch por rol de abajo y
  // no sume latencia; se resuelve justo antes de dehidratar.
  const referralSettingsPromise = supabase
    .from('referral_settings')
    .select('*')
    .eq('tenant', tenantConfig.id)
    .maybeSingle();

  if (rol === 'admin') {
    // ── Single RPC call: get_admin_prefetch returns everything in one round-trip ──
    const [prefetchResult, sortPrefResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.rpc('get_admin_prefetch', { p_admin_id: userId }) as unknown as Promise<{ data: any }>,
      supabase
        .from('user_recursos_preferences')
        .select('sort_by')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const prefetch = prefetchResult.data;

    if (prefetch) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Stats
      const stats = prefetch.stats ?? {};
      queryClient.setQueryData(['admin-stats'], {
        total_alumnos: stats.total_alumnos ?? 0,
        total_profesores: stats.total_profesores ?? 0,
        clases_hoy: stats.clases_hoy ?? 0,
        clases_semana: stats.clases_semana ?? 0,
        clases_mes: stats.clases_mes ?? 0,
        pendientes: stats.pendientes_confirmar ?? 0,
        estado_pendientes: stats.estado_pendientes ?? 0,
        estado_confirmadas: stats.estado_confirmadas ?? 0,
        estado_canceladas: stats.estado_canceladas ?? 0,
      });

      // Alumnos (shape matching what client expects)
      const alumnos = (prefetch.alumnos ?? []).map((r: Record<string, unknown>) => ({
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
        last_sign_in_at: r.last_sign_in_at ?? null,
      }));
      queryClient.setQueryData(['admin-alumnos'], alumnos);

      // Profesores
      queryClient.setQueryData(['admin-profesores'], prefetch.profesores ?? []);

      // admin-init (legacy compat: alumnos + profesores bundled)
      queryClient.setQueryData(['admin-init'], { alumnos: prefetch.alumnos ?? [], profesores: prefetch.profesores ?? [] });

      // Notifications dashboard widget (already has leida computed for this admin)
      queryClient.setQueryData(['admin-notificaciones-dash'], prefetch.notificaciones ?? []);

      // Notifications full view (page /admin/notificaciones)
      queryClient.setQueryData(['notificaciones-full'], prefetch.notificaciones_full ?? { data: [], total: 0, page: 1, page_size: 500, total_pages: 1 });

      // Notificaciones panel navbar — key ['notificaciones'] (top 10, mismo dato que el dash)
      queryClient.setQueryData(['notificaciones'], prefetch.notificaciones ?? []);

      // Today's classes
      queryClient.setQueryData(['admin-clases-hoy'], prefetch.clases_hoy ?? []);

      // All horarios for CalendarioAdmin (dashboard + agenda)
      queryClient.setQueryData(['admin-horarios'], prefetch.horarios_calendario ?? []);

      // Bloqueos horario (todos) — key usada por useBloqueos en admin
      queryClient.setQueryData(['bloqueos-horario', 'all'], prefetch.bloqueos ?? []);

      // Programas (todos)
      queryClient.setQueryData(['programas', 'todos'], prefetch.programas ?? []);

      // Pagos — current month
      queryClient.setQueryData(['admin-pagos', currentYear, currentMonth], prefetch.pagos_mes ?? []);

      // Pagos — annual summary
      queryClient.setQueryData(['admin-pagos-anual', currentYear], prefetch.pagos_anual ?? []);

      // Recursos
      const recursos = prefetch.recursos ?? {};
      queryClient.setQueryData(['recursos', userId], {
        recursos: recursos.recursos ?? [],
        carpetas: recursos.carpetas ?? [],
      });

      // Recursos sort preference — avoids flash of re-ordering on initial load
      queryClient.setQueryData(['recursos_sort_pref', userId], sortPrefResult.data?.sort_by ?? 'created_at_desc');
    }

    // Question Bank settings — prefetch so /pagina shows the button instantly
    const { data: qbSettings } = await supabase
      .from('question_bank_settings')
      .select('*')
      .eq('tenant', tenantConfig.id)
      .maybeSingle();

    queryClient.setQueryData(['qb-settings'], qbSettings ?? { question_bank_enabled: false, tenant: tenantConfig.id });
  }

  if (rol === 'profesor') {
    // ── Single RPC call for profesor ─────────────────────────────────────────
    const [prefetchResult, sortPrefResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.rpc('get_profesor_prefetch', { p_profesor_id: userId }) as unknown as Promise<{ data: any }>,
      supabase
        .from('user_recursos_preferences')
        .select('sort_by')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const prefetch = prefetchResult.data;

    if (prefetch) {
      // Horarios + stats + alumnos (same shape as get_profesor_dashboard)
      queryClient.setQueryData(['horarios', userId], prefetch.horarios ?? null);

      // Mis alumnos tab (scope='mis')
      const misAlumnos = (prefetch.mis_alumnos ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        alumnos_extra: r.alumno_id ? [{
          alumno_id: r.alumno_id, profesor_id: r.profesor_id, universidad: r.universidad,
          año_ingreso: r.año_ingreso, notas: r.notas, paso_prueba: r.paso_prueba,
          fecha_prueba: r.fecha_prueba, ha_dado_examen: r.ha_dado_examen, intentos_prueba: r.intentos_prueba,
        }] : [],
      }));
      queryClient.setQueryData(['alumnos', 'mis'], misAlumnos);

      // Todos los alumnos tab (scope='todos')
      const todosAlumnos = (prefetch.todos_alumnos ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        alumnos_extra: r.alumno_id ? [{
          alumno_id: r.alumno_id, profesor_id: r.profesor_id, universidad: r.universidad,
          año_ingreso: r.año_ingreso, notas: r.notas, paso_prueba: r.paso_prueba,
          fecha_prueba: r.fecha_prueba, ha_dado_examen: r.ha_dado_examen, intentos_prueba: r.intentos_prueba,
        }] : [],
      }));
      queryClient.setQueryData(['alumnos', 'todos'], todosAlumnos);

      // Programas activos
      queryClient.setQueryData(['programas', 'activo'], prefetch.programas ?? []);

      // Notificaciones full view
      queryClient.setQueryData(['notificaciones-full'], prefetch.notificaciones_full ?? { data: [], total: 0, page: 1, page_size: 500, total_pages: 1 });

      // Notificaciones panel navbar
      queryClient.setQueryData(['notificaciones'], (prefetch.notificaciones_full?.data ?? []).slice(0, 30));

      // Bloqueos propios del profesor
      queryClient.setQueryData(['bloqueos-horario', userId], prefetch.bloqueos ?? []);

      // Recursos
      const recursos = prefetch.recursos ?? {};
      queryClient.setQueryData(['recursos', userId], {
        recursos: recursos.recursos ?? [],
        carpetas: recursos.carpetas ?? [],
      });

      // Recursos sort preference — avoids flash of re-ordering on initial load
      queryClient.setQueryData(['recursos_sort_pref', userId], sortPrefResult.data?.sort_by ?? 'created_at_desc');
    }
  }

  if (rol === 'alumno') {
    // ── Single RPC call for alumno ───────────────────────────────────────────
    const [prefetchResult, sortPrefResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.rpc('get_alumno_prefetch', { p_alumno_id: userId }) as unknown as Promise<{ data: any }>,
      supabase
        .from('user_recursos_preferences')
        .select('sort_by')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const prefetch = prefetchResult.data;

    if (prefetch) {
      // Asistencia dashboard (clases, proxima_clase, stats)
      queryClient.setQueryData(['asistencia', userId], prefetch.asistencia ?? null);

      // Ficha del propio alumno (página /alumno/perfil)
      if (prefetch.ficha_perfil) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ficha = prefetch.ficha_perfil as any;
        if (ficha?.profile) {
          queryClient.setQueryData(['ficha-alumno', userId], {
            ...ficha.profile,
            alumnos_extra: ficha.extra,
            notas_alumno: ficha.notas_alumno || [],
            historial_clases: ficha.horarios || [],
            pruebas: ficha.pruebas || [],
            ficha_stats: ficha.stats,
          });
        }
      }

      // Notificaciones full view
      queryClient.setQueryData(['notificaciones-full'], prefetch.notificaciones_full ?? { data: [], total: 0, page: 1, page_size: 500, total_pages: 1 });

      // Notificaciones panel navbar
      queryClient.setQueryData(['notificaciones'], (prefetch.notificaciones_full?.data ?? []).slice(0, 30));

      // Recursos
      const recursosAlumno = prefetch.recursos ?? {};
      queryClient.setQueryData(['recursos', userId], {
        recursos: recursosAlumno.recursos ?? [],
        carpetas: recursosAlumno.carpetas ?? [],
      });

      // Recursos sort preference
      queryClient.setQueryData(['recursos_sort_pref', userId], sortPrefResult.data?.sort_by ?? 'created_at_desc');
    }
  }

  if (rol === 'lector') {
    // ── Single RPC call for lector ───────────────────────────────────────────
    const [prefetchResult, sortPrefResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.rpc('get_lector_prefetch', { p_lector_id: userId }) as unknown as Promise<{ data: any }>,
      supabase
        .from('user_recursos_preferences')
        .select('sort_by')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const prefetch = prefetchResult.data;

    if (prefetch) {
      const recursos = prefetch.recursos ?? {};
      queryClient.setQueryData(['recursos', userId], {
        recursos: recursos.recursos ?? [],
        carpetas: recursos.carpetas ?? [],
      });

      // Recursos sort preference
      queryClient.setQueryData(['recursos_sort_pref', userId], sortPrefResult.data?.sort_by ?? 'created_at_desc');
    }
  }

  // ── Referidos: settings en caché antes del primer render ──────────────────
  // Evita el parpadeo del banner "sistema desactivado" y del botón del sidebar
  // mientras se resolvía la consulta en el cliente. El fallback replica la
  // respuesta de GET /api/referidos/settings cuando el tenant no tiene fila.
  const { data: referralSettings } = await referralSettingsPromise;
  queryClient.setQueryData(
    ['referral-settings'],
    referralSettings ?? {
      tenant: tenantConfig.id,
      platform_enabled: false,
      tenant_enabled: false,
      display_name: 'Sistema de Referidos',
      icon: 'star',
      reader_role_enabled: true,
      discount_codes_module_enabled: false,
      discount_codes_display_name: 'Código de Descuento',
      show_rewards_to_user: true,
      show_referral_count_to_user: true,
      user_welcome_message: '',
    }
  );

  return dehydrate(queryClient);
}
