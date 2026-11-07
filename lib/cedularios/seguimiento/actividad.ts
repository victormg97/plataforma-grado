/**
 * Describes one audit entry of the tracking as an i18n template.
 * Pure module: no React, no Supabase.
 *
 * `clave` is relative to the namespace `cedularios.seguimiento.actividad`.
 * Keys in use (one per table and field):
 *   asignacion_created, asignacion_deleted,
 *   asignacion_estado_reactivada, asignacion_estado_desasignada,
 *   progreso_created, progreso_deleted,
 *   progreso_asignada_agregada, progreso_asignada_archivada,
 *   progreso_estado_cubierta, progreso_estado_pendiente,
 *   progreso_fecha_cubierta, progreso_notas,
 *   repaso_created, repaso_deleted, repaso_fecha, repaso_nota,
 *   comentario_created, comentario_deleted, comentario_texto,
 *   clase_created, clase_deleted,
 *   generico (unknown table or field, params: {campo}).
 * `params` holds the values the template interpolates ({anterior}, {nuevo}, {fecha},
 * {nota}, {texto}, {titulo}). Long texts are shortened so the list stays readable.
 */

/** Maximum length of a text value shown in a template. */
const MAX_VALOR = 120;

export interface CambioActividad {
  tabla: string;
  campo: string;
  valorAnterior: unknown;
  valorNuevo: unknown;
}

export interface DescripcionCambio {
  clave: string;
  params: Record<string, string | number>;
}

type Params = Record<string, string | number>;

function recortar(texto: string): string {
  return texto.length > MAX_VALOR ? `${texto.slice(0, MAX_VALOR - 1)}\u2026` : texto;
}

/** Scalar value as display text: null and undefined become an empty string. */
function aTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return recortar(valor);
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return '';
}

/** Reads a field of a JSON object value ({ id, texto }, { id, fecha, nota }, ...). */
function campoDe(valor: unknown, campo: string): string {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return '';
  return aTexto((valor as Record<string, unknown>)[campo]);
}

/** Value that carries the content of a created or deleted row. */
const contenido = (c: CambioActividad): unknown =>
  c.campo === 'deleted' ? c.valorAnterior : c.valorNuevo;

const esAltaOBaja = (campo: string): boolean => campo === 'created' || campo === 'deleted';

function describirAsignacion(c: CambioActividad): DescripcionCambio | null {
  if (esAltaOBaja(c.campo)) return { clave: `asignacion_${c.campo}`, params: {} };
  if (c.campo === 'estado') {
    const reactivada = c.valorNuevo === 'activa';
    return {
      clave: reactivada ? 'asignacion_estado_reactivada' : 'asignacion_estado_desasignada',
      params: {},
    };
  }
  return null;
}

function describirProgreso(c: CambioActividad): DescripcionCambio | null {
  if (esAltaOBaja(c.campo)) return { clave: `progreso_${c.campo}`, params: {} };
  switch (c.campo) {
    case 'asignada':
      return {
        clave: c.valorNuevo === true ? 'progreso_asignada_agregada' : 'progreso_asignada_archivada',
        params: {},
      };
    case 'estado':
      return {
        clave: c.valorNuevo === 'cubierta' ? 'progreso_estado_cubierta' : 'progreso_estado_pendiente',
        params: {},
      };
    case 'fecha_cubierta':
      return {
        clave: 'progreso_fecha_cubierta',
        params: { anterior: aTexto(c.valorAnterior), nuevo: aTexto(c.valorNuevo) },
      };
    case 'notas':
      return {
        clave: 'progreso_notas',
        params: { anterior: aTexto(c.valorAnterior), nuevo: aTexto(c.valorNuevo) },
      };
    default:
      return null;
  }
}

function describirRepaso(c: CambioActividad): DescripcionCambio | null {
  if (esAltaOBaja(c.campo)) {
    const fila = contenido(c);
    return {
      clave: `repaso_${c.campo}`,
      params: { fecha: campoDe(fila, 'fecha'), nota: campoDe(fila, 'nota') },
    };
  }
  if (c.campo === 'fecha' || c.campo === 'nota') {
    return {
      clave: `repaso_${c.campo}`,
      params: { anterior: aTexto(c.valorAnterior), nuevo: aTexto(c.valorNuevo) },
    };
  }
  return null;
}

function describirComentario(c: CambioActividad): DescripcionCambio | null {
  if (esAltaOBaja(c.campo)) {
    return { clave: `comentario_${c.campo}`, params: { texto: campoDe(contenido(c), 'texto') } };
  }
  if (c.campo === 'texto') {
    return {
      clave: 'comentario_texto',
      params: { anterior: aTexto(c.valorAnterior), nuevo: aTexto(c.valorNuevo) },
    };
  }
  return null;
}

function describirClase(c: CambioActividad): DescripcionCambio | null {
  if (esAltaOBaja(c.campo)) {
    return { clave: `clase_${c.campo}`, params: { titulo: campoDe(contenido(c), 'titulo') } };
  }
  return null;
}

/** Template key and parameters for an audit entry. Never throws; unknown entries use 'generico'. */
export function describirCambio(item: CambioActividad): DescripcionCambio {
  let descripcion: DescripcionCambio | null = null;
  switch (item.tabla) {
    case 'cedulario_asignaciones':
      descripcion = describirAsignacion(item);
      break;
    case 'materia_progreso':
      descripcion = describirProgreso(item);
      break;
    case 'materia_progreso_repasos':
      descripcion = describirRepaso(item);
      break;
    case 'materia_progreso_comentarios':
      descripcion = describirComentario(item);
      break;
    case 'materia_progreso_clases':
      descripcion = describirClase(item);
      break;
  }
  if (descripcion) return descripcion;
  const params: Params = { campo: recortar(String(item.campo ?? '')) };
  return { clave: 'generico', params };
}
