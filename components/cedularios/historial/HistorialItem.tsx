'use client';

import { memo, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History } from 'lucide-react';
import type { Json } from '@/lib/supabase/types';
import type { HistorialItem as HistorialItemData } from '@/lib/queries/cedularios/historial';
import { CEDULARIOS_I18N_NAMESPACE } from '@/lib/cedularios/errors';
import type { CedulariosTranslator } from '../hooks/useCedulariosAction';

/** Values longer than this are cut and offered with a "Ver más" toggle. */
export const HISTORIAL_VALOR_MAX_CARACTERES = 160;

/** Pattern of the timestamp; month names come from the `es` locale (Requirement 17.4). */
const PATRON_FECHA = 'dd MMM yyyy, HH:mm';

type Traductor = CedulariosTranslator & { has: (key: string) => boolean };

type ValorMostrado =
  | { tipo: 'vacio' }
  | { tipo: 'documento' }
  | { tipo: 'texto'; texto: string };

function esObjeto(valor: Json): valor is { [key: string]: Json | undefined } {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** TipTap (ProseMirror) JSON document: `{ "type": "doc", "content": [...] }`. */
function esDocumentoTipTap(valor: Json): boolean {
  return esObjeto(valor) && valor.type === 'doc';
}

/**
 * Plain-text representation of a stored value. Never HTML: the result is rendered as a React
 * text node, so markup in the data is shown literally.
 */
function valorMostrado(valor: Json | null | undefined, campo: string, t: Traductor): ValorMostrado {
  if (valor === null || valor === undefined) return { tipo: 'vacio' };
  if (typeof valor === 'string') {
    return valor.trim() === '' ? { tipo: 'vacio' } : { tipo: 'texto', texto: valor };
  }
  if (typeof valor === 'boolean') {
    if (campo === 'activo') {
      return { tipo: 'texto', texto: t(valor ? 'historial.estados.activo' : 'historial.estados.inactivo') };
    }
    return { tipo: 'texto', texto: String(valor) };
  }
  if (typeof valor === 'number') return { tipo: 'texto', texto: String(valor) };
  if (esDocumentoTipTap(valor)) return { tipo: 'documento' };
  return { tipo: 'texto', texto: JSON.stringify(valor) };
}

/** Name of the record taken from a `created` / `deleted` payload (`{ id, nombre | titulo }`). */
function etiquetaDePayload(...valores: Array<Json | null>): string | null {
  for (const valor of valores) {
    if (valor !== null && esObjeto(valor)) {
      for (const clave of ['nombre', 'titulo'] as const) {
        const candidato = valor[clave];
        if (typeof candidato === 'string' && candidato.trim() !== '') return candidato;
      }
    }
  }
  return null;
}

type ClaveAccion = 'created' | 'deleted' | 'activo_true' | 'activo_false' | 'updated';

/** Verb of an entry: created, deleted, activo true to false (deleted), false to true (restored), or updated. */
export function accionDeCambio(item: Pick<HistorialItemData, 'campo' | 'valorAnterior' | 'valorNuevo'>): ClaveAccion {
  if (item.campo === 'created') return 'created';
  if (item.campo === 'deleted') return 'deleted';
  if (item.campo === 'activo') {
    if (item.valorAnterior === true && item.valorNuevo === false) return 'activo_false';
    if (item.valorAnterior === false && item.valorNuevo === true) return 'activo_true';
  }
  return 'updated';
}

function ValorTexto({
  etiqueta,
  valor,
  campo,
  expandido,
  t,
}: {
  etiqueta: string;
  valor: Json | null;
  campo: string;
  expandido: boolean;
  t: Traductor;
}) {
  const mostrado = valorMostrado(valor, campo, t);

  let contenido: string;
  let atenuado = false;
  if (mostrado.tipo === 'vacio') {
    contenido = t('historial.valor_vacio');
    atenuado = true;
  } else if (mostrado.tipo === 'documento') {
    contenido = t('historial.contenido_modificado');
  } else {
    contenido =
      expandido || mostrado.texto.length <= HISTORIAL_VALOR_MAX_CARACTERES
        ? mostrado.texto
        : `${mostrado.texto.slice(0, HISTORIAL_VALOR_MAX_CARACTERES)}…`;
  }

  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[var(--color-text-muted)]">{etiqueta}</dt>
      <dd
        className={
          atenuado
            ? 'mt-0.5 text-sm italic text-[var(--color-text-muted)]'
            : 'mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)]'
        }
      >
        {contenido}
      </dd>
    </div>
  );
}

function esTruncable(valor: Json | null, campo: string, t: Traductor): boolean {
  const mostrado = valorMostrado(valor, campo, t);
  return mostrado.tipo === 'texto' && mostrado.texto.length > HISTORIAL_VALOR_MAX_CARACTERES;
}

export interface HistorialItemProps {
  item: HistorialItemData;
}

/** One entry of the change timeline (Requirements 8.10, 8.12, 11.10, 17.4). */
function HistorialItemBase({ item }: HistorialItemProps) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE) as unknown as Traductor;
  const [expandido, setExpandido] = useState(false);
  const detalleId = useId();

  const accion = accionDeCambio(item);
  const esAltaOBaja = item.campo === 'created' || item.campo === 'deleted';
  const mostrarCampo = accion === 'updated';

  const usuario = item.usuarioNombre?.trim() ? item.usuarioNombre : t('usuario_desconocido');

  const claveTabla = `historial.tablas.${item.tabla}`;
  const tablaTexto = t.has(claveTabla) ? t(claveTabla) : item.tabla;
  const etiqueta =
    item.registroEtiqueta?.trim() || etiquetaDePayload(item.valorNuevo, item.valorAnterior);
  const registro = etiqueta ? `${tablaTexto} ${etiqueta}` : tablaTexto;

  const claveCampo = `historial.campos.${item.campo}`;
  const campoTexto = t.has(claveCampo) ? t(claveCampo) : item.campo;

  const descripcion = mostrarCampo
    ? t('historial.entrada_campo', {
        usuario,
        accion: t('historial.cambios.updated'),
        campo: campoTexto,
        registro,
      })
    : t('historial.entrada', { usuario, accion: t(`historial.cambios.${accion}`), registro });

  const fecha = new Date(item.createdAt);
  const fechaValida = !Number.isNaN(fecha.getTime());

  const mostrarValores = !esAltaOBaja && accion === 'updated';
  const hayTruncado =
    mostrarValores &&
    (esTruncable(item.valorAnterior, item.campo, t) || esTruncable(item.valorNuevo, item.campo, t));

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0 [&:last-child>span[aria-hidden]]:hidden">
      <span
        aria-hidden
        className="absolute bottom-0 left-[15px] top-8 w-px bg-[var(--color-border)]"
      />
      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
        <History className="size-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 break-words text-sm text-[var(--color-text-primary)]">{descripcion}</p>
          {fechaValida && (
            <time
              dateTime={item.createdAt}
              className="shrink-0 text-xs text-[var(--color-text-muted)]"
            >
              {format(fecha, PATRON_FECHA, { locale: es })}
            </time>
          )}
        </div>

        {mostrarValores && (
          <dl
            id={detalleId}
            className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 sm:grid-cols-2"
          >
            <ValorTexto
              etiqueta={t('historial.columnas.valor_anterior')}
              valor={item.valorAnterior}
              campo={item.campo}
              expandido={expandido}
              t={t}
            />
            <ValorTexto
              etiqueta={t('historial.columnas.valor_nuevo')}
              valor={item.valorNuevo}
              campo={item.campo}
              expandido={expandido}
              t={t}
            />
          </dl>
        )}

        {hayTruncado && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            aria-expanded={expandido}
            aria-controls={detalleId}
            className="text-xs font-medium text-[var(--color-brand-gold)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
          >
            {expandido ? t('historial.ver_menos') : t('historial.ver_mas')}
          </button>
        )}
      </div>
    </li>
  );
}

export const HistorialItem = memo(HistorialItemBase);
