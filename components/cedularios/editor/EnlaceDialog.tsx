'use client';

/**
 * Dialog to create, edit or remove a link (Req 13.4, 13.5).
 *
 * The link text and the URL are separate fields. A URL whose protocol is not http, https
 * or mailto is rejected with `errores.url_invalida` and the document stays unchanged.
 */

import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { Editor } from '@tiptap/react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { normalizarUrlEnlace } from './enlaces-permitidos';

/** Selection and values captured when the dialog opens. */
export interface EnlaceInicial {
  from: number;
  to: number;
  texto: string;
  url: string;
  /** True when the selection is inside an existing link. */
  editando: boolean;
}

export interface EnlaceDialogProps {
  editor: Editor;
  inicial: EnlaceInicial;
  onClose: () => void;
}

/** Reads the current selection (extending it to the whole link when inside one). */
export function leerEnlaceInicial(editor: Editor): EnlaceInicial {
  const editando = editor.isActive('link');
  if (editando) editor.chain().focus().extendMarkRange('link').run();
  const { from, to } = editor.state.selection;
  return {
    from,
    to,
    texto: editor.state.doc.textBetween(from, to, ' '),
    url: editando ? String(editor.getAttributes('link').href ?? '') : '',
    editando,
  };
}

export function EnlaceDialog({ editor, inicial, onClose }: EnlaceDialogProps) {
  const t = useTranslations('cedularios');
  const idTexto = useId();
  const idUrl = useId();
  const idError = useId();

  const [texto, setTexto] = useState(inicial.texto);
  const [url, setUrl] = useState(inicial.url);
  const [urlInvalida, setUrlInvalida] = useState(false);

  const cerrar = () => {
    onClose();
    editor.commands.focus();
  };

  const aplicar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const href = normalizarUrlEnlace(url);
    if (href === null) {
      // Rejected: nothing is written to the document.
      setUrlInvalida(true);
      return;
    }

    const { from, to } = inicial;
    const textoFinal = texto.trim().length > 0 ? texto.trim() : href;
    const chain = editor.chain().focus();

    if (from !== to && textoFinal === inicial.texto.trim()) {
      // Same text: keep the existing marks and only set the link.
      chain.setTextSelection({ from, to }).setLink({ href }).run();
    } else {
      chain
        .insertContentAt(
          { from, to },
          { type: 'text', text: textoFinal, marks: [{ type: 'link', attrs: { href } }] },
        )
        .run();
    }
    onClose();
  };

  const quitar = () => {
    editor.chain().focus().setTextSelection({ from: inicial.from, to: inicial.to }).unsetLink().run();
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(abierto) => {
        if (!abierto) cerrar();
      }}
    >
      <DialogContent showCloseButton={false}>
        <form onSubmit={aplicar} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {inicial.editando ? t('editor.enlace.titulo_editar') : t('editor.enlace.titulo_crear')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor={idTexto}>{t('editor.enlace.texto')}</Label>
            <Input
              id={idTexto}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={t('editor.enlace.texto_placeholder')}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={idUrl}>{t('editor.enlace.url')}</Label>
            <Input
              id={idUrl}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setUrlInvalida(false);
              }}
              placeholder={t('editor.enlace.url_placeholder')}
              inputMode="url"
              autoComplete="off"
              autoFocus
              aria-invalid={urlInvalida}
              aria-describedby={urlInvalida ? idError : undefined}
            />
            {urlInvalida && (
              <p id={idError} role="alert" className="text-sm text-destructive">
                {t('errores.url_invalida')}
              </p>
            )}
          </div>

          <DialogFooter>
            {inicial.editando && (
              <Button type="button" variant="destructive" onClick={quitar} className="sm:mr-auto">
                {t('editor.enlace.quitar')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={cerrar}>
              {t('comun.cancelar')}
            </Button>
            <Button type="submit">{t('editor.enlace.aplicar')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
