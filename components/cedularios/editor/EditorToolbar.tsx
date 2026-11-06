'use client';

/**
 * Toolbar of the cedulario editor (Req 13.1-13.4, 13.6, 13.7).
 *
 * Own small toolbar instead of `components/common/RichTextEditor`: that one limits headings to
 * levels 1-3 and reads the `notas` namespace. Every label comes from `cedularios.editor.toolbar`.
 */

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Bold,
  Italic,
  Link as LinkIcon,
  Link2Off,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  Redo2,
  Rows3,
  Columns3,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NIVELES_ENCABEZADO, type VarianteRichText } from '@/lib/cedularios/richtext';

import { EnlaceDialog, leerEnlaceInicial, type EnlaceInicial } from './EnlaceDialog';

export interface EditorToolbarProps {
  editor: Editor;
  /** Tables are offered only for `con_tablas` (temario). */
  variante: VarianteRichText;
}

interface BotonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

function Boton({ label, onClick, active = false, disabled = false, children }: BotonProps) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keeps the selection and focus inside the editor when clicking.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={active ? 'bg-primary/15 text-foreground' : undefined}
    >
      {children}
    </Button>
  );
}

function Separador() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

export function EditorToolbar({ editor, variante }: EditorToolbarProps) {
  const t = useTranslations('cedularios');
  const [enlace, setEnlace] = useState<EnlaceInicial | null>(null);

  const estado = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const nivel = NIVELES_ENCABEZADO.find((n) => ed.isActive('heading', { level: n })) ?? 0;
      return {
        negrita: ed.isActive('bold'),
        cursiva: ed.isActive('italic'),
        subrayado: ed.isActive('underline'),
        tachado: ed.isActive('strike'),
        nivel,
        listaPuntos: ed.isActive('bulletList'),
        listaNumerada: ed.isActive('orderedList'),
        puedeAnidar: ed.can().sinkListItem('listItem'),
        puedeDesanidar: ed.can().liftListItem('listItem'),
        enlace: ed.isActive('link'),
        enTabla: ed.isActive('table'),
        puedeDeshacer: ed.can().undo(),
        puedeRehacer: ed.can().redo(),
      };
    },
  });

  const abrirEnlace = () => setEnlace(leerEnlaceInicial(editor));
  const conTablas = variante === 'con_tablas';

  return (
    <>
      <div
        role="toolbar"
        aria-label={t('editor.toolbar_aria')}
        className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1"
      >
        <Boton
          label={t('editor.toolbar.negrita')}
          active={estado.negrita}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </Boton>
        <Boton
          label={t('editor.toolbar.cursiva')}
          active={estado.cursiva}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </Boton>
        <Boton
          label={t('editor.toolbar.subrayado')}
          active={estado.subrayado}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </Boton>
        <Boton
          label={t('editor.toolbar.tachado')}
          active={estado.tachado}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </Boton>

        <Separador />

        <select
          aria-label={
            estado.nivel === 0
              ? t('editor.toolbar.parrafo')
              : t('editor.toolbar.encabezado', { nivel: estado.nivel })
          }
          value={estado.nivel}
          onChange={(e) => {
            const nivel = Number(e.target.value);
            const chain = editor.chain().focus();
            if (nivel === 0) chain.setParagraph().run();
            else chain.setHeading({ level: nivel as (typeof NIVELES_ENCABEZADO)[number] }).run();
          }}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value={0}>{t('editor.toolbar.parrafo')}</option>
          {NIVELES_ENCABEZADO.map((n) => (
            <option key={n} value={n}>
              {t('editor.toolbar.encabezado', { nivel: n })}
            </option>
          ))}
        </select>

        <Separador />

        <Boton
          label={t('editor.toolbar.lista_puntos')}
          active={estado.listaPuntos}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </Boton>
        <Boton
          label={t('editor.toolbar.lista_numerada')}
          active={estado.listaNumerada}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </Boton>
        <Boton
          label={t('editor.toolbar.anidar_item')}
          disabled={!estado.puedeAnidar}
          onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
        >
          <ListIndentIncrease />
        </Boton>
        <Boton
          label={t('editor.toolbar.desanidar_item')}
          disabled={!estado.puedeDesanidar}
          onClick={() => editor.chain().focus().liftListItem('listItem').run()}
        >
          <ListIndentDecrease />
        </Boton>

        <Separador />

        <Boton label={t('editor.toolbar.enlace')} active={estado.enlace} onClick={abrirEnlace}>
          <LinkIcon />
        </Boton>
        {estado.enlace && (
          <Boton
            label={t('editor.toolbar.quitar_enlace')}
            onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
          >
            <Link2Off />
          </Boton>
        )}

        {conTablas && (
          <>
            <Separador />
            <Boton
              label={t('editor.toolbar.tabla')}
              disabled={estado.enTabla}
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
            >
              <TableIcon />
            </Boton>
            {estado.enTabla && (
              <>
                <Boton
                  label={t('editor.tabla.agregar_fila')}
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                >
                  <BetweenHorizontalStart />
                </Boton>
                <Boton
                  label={t('editor.tabla.eliminar_fila')}
                  onClick={() => editor.chain().focus().deleteRow().run()}
                >
                  <Rows3 />
                </Boton>
                <Boton
                  label={t('editor.tabla.agregar_columna')}
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                >
                  <BetweenVerticalStart />
                </Boton>
                <Boton
                  label={t('editor.tabla.eliminar_columna')}
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                >
                  <Columns3 />
                </Boton>
                <Boton
                  label={t('editor.tabla.eliminar_tabla')}
                  onClick={() => editor.chain().focus().deleteTable().run()}
                >
                  <Trash2 />
                </Boton>
              </>
            )}
          </>
        )}

        <Separador />

        <Boton
          label={t('editor.toolbar.deshacer')}
          disabled={!estado.puedeDeshacer}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 />
        </Boton>
        <Boton
          label={t('editor.toolbar.rehacer')}
          disabled={!estado.puedeRehacer}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 />
        </Boton>
      </div>

      {enlace && <EnlaceDialog editor={editor} inicial={enlace} onClose={() => setEnlace(null)} />}
    </>
  );
}
