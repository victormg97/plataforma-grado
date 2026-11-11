/**
 * Helpers internos para FormularioActividad.
 * Separados del componente principal para mantener el archivo bajo 400 líneas.
 */
import type { CategoriaAgenda } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/client';
import type { AlumnoOption } from './SelectorDestinatarios';

// ─── Constants ──────────────────────────────────────────────────────────────

export const CATEGORIAS: CategoriaAgenda[] = [
  'clase', 'reunion', 'estudio', 'personal',
  'administrativo', 'evento_externo', 'plazo', 'otro',
];

export const COLOR_POR_CATEGORIA: Record<CategoriaAgenda, string> = {
  clase: 'var(--color-agenda-clase)',
  reunion: 'var(--color-agenda-reunion)',
  estudio: 'var(--color-agenda-estudio)',
  personal: 'var(--color-agenda-personal)',
  administrativo: 'var(--color-agenda-administrativo)',
  evento_externo: 'var(--color-agenda-evento-externo)',
  plazo: 'var(--color-agenda-plazo)',
  otro: 'var(--color-agenda-otro)',
};

// ─── Alumno fetcher (same pattern as HorarioForm) ───────────────────────────

export async function fetchAlumnosForActividad(
  fetchTargetId: string,
  isAdmin: boolean,
): Promise<AlumnoOption[]> {
  if (!fetchTargetId) return [];
  const supabase = createClient();
  if (isAdmin) {
    const { data } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, email, avatar_url')
      .eq('rol', 'alumno')
      .eq('activo', true)
      .order('nombre');
    return (data as AlumnoOption[]) ?? [];
  }
  const { data: links } = await supabase
    .from('alumnos_extra')
    .select('alumno_id')
    .eq('profesor_id', fetchTargetId);
  if (!links || links.length === 0) return [];
  const ids = links.map((d) => d.alumno_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, email, avatar_url')
    .in('id', ids)
    .eq('activo', true)
    .order('nombre');
  return (profiles as AlumnoOption[]) ?? [];
}

// ─── Default form values ────────────────────────────────────────────────────

/** Valores por defecto de un formulario de actividad nueva. */
export function buildActividadDefaults(
  defaultDate?: string,
  defaultTime?: string,
  defaultEndTime?: string,
) {
  const endTime = defaultEndTime ?? (defaultTime
    ? `${String(Math.min(Number(defaultTime.split(':')[0]) + 1, 23)).padStart(2, '0')}:${defaultTime.split(':')[1]}`
    : undefined);
  return {
    titulo: '',
    fecha: defaultDate ?? '',
    hora_inicio: defaultTime ?? undefined,
    hora_fin: endTime ?? undefined,
    dia_completo: false,
    categoria: 'otro' as CategoriaAgenda,
    visibilidad: 'privada' as 'privada' | 'publica',
    alcance: 'todos_alumnos' as 'alumnos_seleccionados' | 'todos_alumnos',
    destinatarios: [] as string[],
    descripcion: '',
    nota: '',
    lugar: '',
    enlace_conexion: '',
  };
}
