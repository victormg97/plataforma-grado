'use client';

/**
 * Rich-text field with autosave for the Normativa and Rúbrica tabs and the materia temario
 * (Req 2.5, 2.7, 2.8, 4.7, 4.8, 11.7, 13.1-13.16, 16.7, 16.10, 18.7, 18.8).
 *
 * Wires `useAutosave` to the Server Action hooks, the editor, `SaveIndicator` and the
 * stale-content toast. The parent that owns the query (`useCedulario` / `useMateria`) passes the
 * latest server document in `remoto`; the hook applies it silently when the editor is clean and
 * raises the "updated by another user" toast with a Refresh button when it is not.
 *
 * Permissions: when `puedeEditar` is false the saved text is shown in a read-only editor and
 * nothing is ever sent. If the permission is lost while the user has unsaved text, that text stays
 * visible (read-only) and is not saved. If the permission comes back, the autosave hook is
 * remounted (the hook cannot resume by itself) and starts again from `contenidoInicial`.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { ActionResult } from '@/lib/cedularios/action-result';
import { docVacio, sanitizeDoc, type TiptapDoc, type VarianteRichText } from '@/lib/cedularios/richtext';

import { useGuardarContenidoCedulario } from '../hooks/useCedularios';
import { useGuardarTemario } from '../hooks/useMaterias';
import { useAutosave, type ContenidoAutosave } from '../hooks/useAutosave';
import { CedularioRichEditorLazy } from './CedularioRichEditorLazy';
import { SaveIndicator } from './SaveIndicator';

export type RichTextScope = 'cedulario-normativa' | 'cedulario-rubrica' | 'materia-temario';

export interface RichTextFieldProps {
  scope: RichTextScope;
  /** Cedulario id for normativa and rúbrica, materia id for the temario. */
  recordId: string;
  /** Content loaded from the database when the field opens. `null` is an empty field. */
  contenidoInicial: TiptapDoc | null;
  /** False for alumno, lector and a profesor who is neither creator nor collaborator. */
  puedeEditar: boolean;
  /**
   * `updated_at` of the loaded record. Not used for rendering; the parent already derives
   * `remoto` from the refetched record, which is what drives the stale-content handling.
   */
  updatedAt?: string | null;
  /**
   * Latest document known from the server (query data). `undefined` means "no information".
   * Pass it through whenever the query refetches, including after a Realtime-triggered refetch.
   */
  remoto?: TiptapDoc | null;
  /** Editor focus, for presence. */
  onFocus?: () => void;
  /** Editor blur, for presence. */
  onBlur?: () => void;
  className?: string;
}

/** The editor shows its own save status, so the mutations stay silent. */
const OPCIONES_AUTOSAVE = { skipSuccessToast: true, skipErrorToast: true } as const;

const CLAVES: Record<RichTextScope, { placeholder: string; vacio: string; titulo: string }> = {
  'cedulario-normativa': {
    placeholder: 'normativa.placeholder',
    vacio: 'normativa.vacio',
    titulo: 'normativa.titulo',
  },
  'cedulario-rubrica': {
    placeholder: 'rubrica.placeholder',
    vacio: 'rubrica.vacio',
    titulo: 'rubrica.titulo',
  },
  'materia-temario': {
    placeholder: 'materia.placeholders.temario',
    vacio: 'materia.temario_vacio',
    titulo: 'materia.campos.temario',
  },
};

function varianteDe(scope: RichTextScope): VarianteRichText {
  return scope === 'materia-temario' ? 'con_tablas' : 'sin_tablas';
}

/** True for `null` and for a document that only holds empty paragraphs. */
function esContenidoVacio(doc: ContenidoAutosave): boolean {
  if (!doc) return true;
  const bloques = doc.content ?? [];
  return bloques.every(
    (b) => b.type === 'paragraph' && (b.content === undefined || b.content.length === 0),
  );
}

export function RichTextField(props: RichTextFieldProps) {
  // The autosave hook cannot resume after losing permission, so a regained permission
  // remounts it. Losing permission does not remount: the unsaved text must survive.
  const [puedeEditarPrevio, setPuedeEditarPrevio] = useState(props.puedeEditar);
  const [epoca, setEpoca] = useState(0);
  if (props.puedeEditar !== puedeEditarPrevio) {
    setPuedeEditarPrevio(props.puedeEditar);
    if (props.puedeEditar) setEpoca((e) => e + 1);
  }

  return <RichTextFieldInterno key={`${props.scope}:${props.recordId}:${epoca}`} {...props} />;
}

function RichTextFieldInterno({
  scope,
  recordId,
  contenidoInicial,
  puedeEditar,
  remoto,
  onFocus,
  onBlur,
  className,
}: RichTextFieldProps) {
  const t = useTranslations('cedularios');
  const variante = varianteDe(scope);
  const claves = CLAVES[scope];

  const { mutateAsync: guardarContenidoCedulario } = useGuardarContenidoCedulario(OPCIONES_AUTOSAVE);
  const { mutateAsync: guardarTemario } = useGuardarTemario(OPCIONES_AUTOSAVE);

  const guardar = useCallback(
    async (doc: ContenidoAutosave): Promise<ActionResult<unknown>> => {
      // Second client-side whitelist pass; the server repeats it.
      const limpio = sanitizeDoc(doc ?? docVacio(), variante);
      if (scope === 'materia-temario') {
        return guardarTemario({ id: recordId, doc: limpio });
      }
      return guardarContenidoCedulario({
        id: recordId,
        campo: scope === 'cedulario-normativa' ? 'normativa' : 'rubrica',
        doc: limpio,
      });
    },
    [scope, recordId, variante, guardarTemario, guardarContenidoCedulario],
  );

  const autosave = useAutosave({ contenidoInicial, guardar, puedeEditar, remoto });
  const { contenidoRemotoPendiente, refrescar } = autosave;

  const soloLectura = !puedeEditar || autosave.sinPermisos;

  // Stale-content toast: stays until Refresh, dismissal, or until the pending flag clears.
  useEffect(() => {
    if (!contenidoRemotoPendiente) return;
    const toastId = `cedularios-contenido-${scope}-${recordId}`;
    toast.info(t('editor.actualizado_por_otro'), {
      id: toastId,
      duration: Infinity,
      dismissible: true,
      closeButton: true,
      action: { label: t('editor.actualizar_contenido'), onClick: () => refrescar() },
    });
    return () => {
      toast.dismiss(toastId);
    };
  }, [contenidoRemotoPendiente, refrescar, scope, recordId, t]);

  if (soloLectura && esContenidoVacio(autosave.contenido) && !autosave.hayCambiosSinGuardar) {
    return (
      <p className={className ? `text-sm text-muted-foreground ${className}` : 'text-sm text-muted-foreground'}>
        {t(claves.vacio)}
      </p>
    );
  }

  return (
    <div className={className ? `flex flex-col gap-2 ${className}` : 'flex flex-col gap-2'}>
      <CedularioRichEditorLazy
        variante={variante}
        contenido={autosave.contenido}
        onChange={autosave.setContenido}
        readOnly={soloLectura}
        placeholderKey={claves.placeholder}
        ariaLabel={t(claves.titulo)}
        onFocus={onFocus}
        onBlur={onBlur}
        revisionExterna={autosave.revisionExterna}
      />

      {(!soloLectura || autosave.hayCambiosSinGuardar) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SaveIndicator
            fase={autosave.fase}
            guardadoVisible={autosave.guardadoVisible}
            hayCambiosSinGuardar={autosave.hayCambiosSinGuardar}
            error={autosave.error}
            onReintentar={autosave.reintentar}
          />
          {soloLectura && (
            <span className="text-xs text-muted-foreground">{t('editor.solo_lectura')}</span>
          )}
        </div>
      )}
    </div>
  );
}
