import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { ProgresoFila } from '@/lib/cedularios/seguimiento/tipos';

type Client = SupabaseClient<Database>;

/** A comment of a progress row, oldest first in the list. */
export interface ComentarioDetalle {
  id: string;
  texto: string;
  /** Author profile id, or null when the profile was deleted. */
  autorId: string | null;
  autorNombre: string | null;
  createdAt: string;
  /** Set when the text was edited after creation. */
  editedAt: string | null;
}

/** A review of a materia, newest first in the list. */
export interface RepasoDetalle {
  id: string;
  /** 'yyyy-MM-dd'. */
  fecha: string;
  nota: string | null;
  autorId: string | null;
  autorNombre: string | null;
  createdAt: string;
}

/** A class linked to a progress row. `id` is the id of the link, not of the class. */
export interface ClaseVinculadaDetalle {
  id: string;
  horarioId: string;
  titulo: string | null;
  /** 'yyyy-MM-dd' or null when the class has no date. */
  fecha: string | null;
  horaInicio: string | null;
  /** False when the class was deactivated or cancelled. */
  activo: boolean;
}

/** Detail of a progress row loaded when the materia panel opens. */
export interface ProgresoDetalle {
  comentarios: ComentarioDetalle[];
  repasos: RepasoDetalle[];
  clases: ClaseVinculadaDetalle[];
}

type Registro = Record<string, unknown>;

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function textoRequerido(fila: Registro, clave: string): string {
  const valor = fila[clave];
  if (typeof valor !== 'string') {
    throw new Error(`get_progreso_detalle: invalid field "${clave}"`);
  }
  return valor;
}

function textoOpcional(fila: Registro, clave: string): string | null {
  const valor = fila[clave];
  return typeof valor === 'string' ? valor : null;
}

/** Author id: accepts `created_by` (column name) or `autor_id`. */
function autorIdDe(fila: Registro): string | null {
  return textoOpcional(fila, 'created_by') ?? textoOpcional(fila, 'autor_id');
}

function listaDe(raiz: Registro, clave: string): Registro[] {
  const valor = raiz[clave];
  if (valor === null || valor === undefined) return [];
  if (!Array.isArray(valor)) {
    throw new Error(`get_progreso_detalle: "${clave}" is not a list`);
  }
  return valor.map((item) => {
    if (!esRegistro(item)) {
      throw new Error(`get_progreso_detalle: invalid item in "${clave}"`);
    }
    return item;
  });
}

/**
 * Type guard for the jsonb returned by `get_progreso_detalle`.
 * Validates the shape before the UI uses it and maps snake_case keys to camelCase.
 * Throws when the payload does not have the expected shape.
 */
export function parseProgresoDetalle(json: unknown): ProgresoDetalle {
  if (!esRegistro(json)) {
    throw new Error('get_progreso_detalle: payload is not an object');
  }

  const comentarios = listaDe(json, 'comentarios').map(
    (fila): ComentarioDetalle => ({
      id: textoRequerido(fila, 'id'),
      texto: textoRequerido(fila, 'texto'),
      autorId: autorIdDe(fila),
      autorNombre: textoOpcional(fila, 'autor_nombre'),
      createdAt: textoRequerido(fila, 'created_at'),
      editedAt: textoOpcional(fila, 'edited_at'),
    })
  );

  const repasos = listaDe(json, 'repasos').map(
    (fila): RepasoDetalle => ({
      id: textoRequerido(fila, 'id'),
      fecha: textoRequerido(fila, 'fecha'),
      nota: textoOpcional(fila, 'nota'),
      autorId: autorIdDe(fila),
      autorNombre: textoOpcional(fila, 'autor_nombre'),
      createdAt: textoRequerido(fila, 'created_at'),
    })
  );

  const clases = listaDe(json, 'clases').map(
    (fila): ClaseVinculadaDetalle => ({
      id: textoRequerido(fila, 'id'),
      horarioId: textoRequerido(fila, 'horario_id'),
      titulo: textoOpcional(fila, 'titulo'),
      fecha: textoOpcional(fila, 'fecha'),
      horaInicio: textoOpcional(fila, 'hora_inicio'),
      activo: fila.activo !== false,
    })
  );

  return { comentarios, repasos, clases };
}

/**
 * Flat progress list of an assignment, one row per materia, with the counts of
 * repasos, comentarios and clases. RLS decides what each role sees: a student
 * only gets rows with asignada = true.
 */
export async function fetchProgresoAsignacion(
  client: Client,
  asignacionId: string
): Promise<ProgresoFila[]> {
  // PostgREST caps each response (1000 rows by default), so read it page by page,
  // ordered by id so the pages do not overlap.
  const PAGINA = 1000;
  const filas: Database['public']['Functions']['get_asignacion_progreso']['Returns'] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await client
      .rpc('get_asignacion_progreso', { p_asignacion_id: asignacionId })
      .order('id', { ascending: true })
      .range(desde, desde + PAGINA - 1);

    if (error) throw error;

    const pagina = data ?? [];
    filas.push(...pagina);
    if (pagina.length < PAGINA) break;
  }

  return filas.map(
    (fila): ProgresoFila => ({
      id: fila.id,
      materiaId: fila.materia_id,
      asignada: fila.asignada,
      estado: fila.estado === 'cubierta' ? 'cubierta' : 'pendiente',
      fechaCubierta: fila.fecha_cubierta,
      notas: fila.notas,
      repasos: Number(fila.repasos),
      comentarios: Number(fila.comentarios),
      clases: Number(fila.clases),
      updatedAt: fila.updated_at,
    })
  );
}

/**
 * Comments, repasos and linked classes of one progress row in a single request.
 * Loaded only when the materia detail panel opens.
 */
export async function fetchProgresoDetalle(
  client: Client,
  progresoId: string
): Promise<ProgresoDetalle> {
  const { data, error } = await client.rpc('get_progreso_detalle', {
    p_progreso_id: progresoId,
  });

  if (error) throw error;
  return parseProgresoDetalle(data);
}
