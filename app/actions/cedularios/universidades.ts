'use server';

import { actionFail, actionOk, logActionError, runAction, type ActionResult } from '@/lib/cedularios/action-result';
import {
  errorDeDb,
  obtenerContextoStaff,
  parsear,
  parsearId,
  type Fallo,
  type UniversidadRow,
} from '@/lib/cedularios/contexto-accion';
import { evaluarEliminacionUniversidad } from '@/lib/cedularios/eliminacion';
import { universidadSchema, type UniversidadInput } from '@/lib/cedularios/schemas';

const BUCKET_LOGOS = 'cedularios-logos';
const MARCADOR_URL_PUBLICA = `/object/public/${BUCKET_LOGOS}/`;

/** Adds the field error for a duplicated código (Req 1.3) to a mapped database error. */
function conCampoCodigo(fallo: Fallo): Fallo {
  if (fallo.error.code === 'codigo_universidad_duplicado') {
    fallo.error.fields = { codigo: 'codigo_universidad_duplicado' };
  }
  return fallo;
}

/** Storage path of an object of the logos bucket from its public URL, or null. */
function rutaDesdeUrlPublica(url: string | null): string | null {
  if (!url) return null;
  const indice = url.indexOf(MARCADOR_URL_PUBLICA);
  if (indice < 0) return null;
  const resto = url.slice(indice + MARCADOR_URL_PUBLICA.length).split(/[?#]/)[0] ?? '';
  try {
    const ruta = decodeURIComponent(resto);
    return ruta.length > 0 ? ruta : null;
  } catch {
    return null;
  }
}

/** A logo path must be `<id>/<file>` with no traversal segments. */
function rutaLogoValida(id: string, ruta: unknown): ruta is string {
  if (typeof ruta !== 'string' || !ruta.startsWith(`${id}/`)) return false;
  const resto = ruta.slice(id.length + 1);
  if (resto.length === 0 || resto.includes('\\')) return false;
  return resto.split('/').every((segmento) => segmento.length > 0 && segmento !== '.' && segmento !== '..');
}

// ---------------------------------------------------------------------------
// crearUniversidad
// ---------------------------------------------------------------------------

/** Creates a universidad. `created_by` is forced to the caller by the database trigger. */
export async function crearUniversidad(input: UniversidadInput): Promise<ActionResult<UniversidadRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'crearUniversidad', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const datos = parsear(universidadSchema, input);
    if (!datos.ok) return datos;

    const { data, error } = await supabase
      .from('universidades')
      .insert({ nombre: datos.data.nombre, codigo: datos.data.codigo, created_by: userId })
      .select()
      .single();

    if (error) return conCampoCodigo(errorDeDb(error));
    return actionOk(data);
  });
}

// ---------------------------------------------------------------------------
// editarUniversidad
// ---------------------------------------------------------------------------

/**
 * Edits nombre and código. A profesor who did not create the universidad updates
 * zero rows (RLS), which is reported as `sin_permisos` (Req 1.13).
 */
export async function editarUniversidad(
  id: string,
  input: UniversidadInput,
): Promise<ActionResult<UniversidadRow>> {
  let userId: string | null = null;

  return runAction({ accion: 'editarUniversidad', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const idValido = parsearId(id);
    if (!idValido.ok) return idValido;
    const datos = parsear(universidadSchema, input);
    if (!datos.ok) return datos;

    const { data, error } = await supabase
      .from('universidades')
      .update({ nombre: datos.data.nombre, codigo: datos.data.codigo })
      .eq('id', idValido.data)
      .select()
      .maybeSingle();

    if (error) return conCampoCodigo(errorDeDb(error));
    if (!data) return actionFail('sin_permisos');
    return actionOk(data);
  });
}

// ---------------------------------------------------------------------------
// guardarLogoUniversidad
// ---------------------------------------------------------------------------

/**
 * Stores the public URL of a logo the browser already uploaded to `path`
 * (`<universidad_id>/<file>`). The previous logo_url stays unchanged when saving
 * fails. Removing the previous object is best effort and never fails the action.
 */
export async function guardarLogoUniversidad(
  id: string,
  path: string,
): Promise<ActionResult<{ logo_url: string }>> {
  let userId: string | null = null;

  return runAction({ accion: 'guardarLogoUniversidad', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const idValido = parsearId(id);
    if (!idValido.ok) return idValido;
    const universidadId = idValido.data;

    if (!rutaLogoValida(universidadId, path)) return actionFail('validacion', { fields: { logo: 'validacion' } });

    const { data: previa, error: errorPrevia } = await supabase
      .from('universidades')
      .select('logo_url')
      .eq('id', universidadId)
      .maybeSingle();

    if (errorPrevia) return errorDeDb(errorPrevia);
    if (!previa) return actionFail('sin_permisos');

    const { data: publica } = supabase.storage.from(BUCKET_LOGOS).getPublicUrl(path);
    const logoUrl = publica.publicUrl;

    const { data: actualizada, error } = await supabase
      .from('universidades')
      .update({ logo_url: logoUrl })
      .eq('id', universidadId)
      .select('id')
      .maybeSingle();

    if (error) return errorDeDb(error);
    if (!actualizada) return actionFail('sin_permisos');

    // Best-effort cleanup of the previous object. Only objects under this
    // universidad's own folder are removed.
    const rutaAnterior = rutaDesdeUrlPublica(previa.logo_url);
    if (rutaAnterior && rutaAnterior !== path && rutaAnterior.startsWith(`${universidadId}/`)) {
      try {
        const { error: errorBorrado } = await supabase.storage.from(BUCKET_LOGOS).remove([rutaAnterior]);
        if (errorBorrado) logActionError('guardarLogoUniversidad.limpiezaLogoAnterior', 'error_generico', userId);
      } catch {
        logActionError('guardarLogoUniversidad.limpiezaLogoAnterior', 'error_generico', userId);
      }
    }

    return actionOk({ logo_url: logoUrl });
  });
}

// ---------------------------------------------------------------------------
// eliminarUniversidad
// ---------------------------------------------------------------------------

/**
 * Soft-deletes a universidad when it has no active cedularios. Otherwise returns
 * `universidad_con_cedularios` with `params.count`.
 *
 * The soft delete goes through `desactivar_universidad` without `.select()`: the
 * SELECT policy rejects the new inactive row for non-admins, so a RETURNING clause
 * would fail the update.
 */
export async function eliminarUniversidad(id: string): Promise<ActionResult<void>> {
  let userId: string | null = null;

  return runAction({ accion: 'eliminarUniversidad', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const idValido = parsearId(id);
    if (!idValido.ok) return idValido;

    const { count, error: errorConteo } = await supabase
      .from('cedularios')
      .select('id', { count: 'exact', head: true })
      .eq('universidad_id', idValido.data)
      .eq('activo', true);

    if (errorConteo) return errorDeDb(errorConteo);

    const evaluacion = evaluarEliminacionUniversidad(count ?? 0);
    if (!evaluacion.permitido) {
      return actionFail('universidad_con_cedularios', { params: { count: evaluacion.cantidad } });
    }

    const { data: desactivada, error } = await supabase.rpc('desactivar_universidad', { p_id: idValido.data });

    if (error) return errorDeDb(error);
    // false: the universidad is missing, already inactive, or RLS filtered the update.
    if (!desactivada) return actionFail('sin_permisos');
    return actionOk();
  });
}
