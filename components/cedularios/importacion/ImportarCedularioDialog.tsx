'use client';

import { useId, useMemo, useRef, useState, type DragEvent } from 'react';
import { ArrowLeft, ArrowRight, FileUp, Redo2, Undo2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UniversidadRef } from '@/lib/cedularios/importacion';
import { cn } from '@/lib/utils';
import { useCedularios } from '../hooks/useCedularios';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useUniversidades } from '../hooks/useUniversidades';
import { ArbolRevision, type ArbolRevisionHandle } from './ArbolRevision';
import { ErrorLectura } from './extraerPdf';
import { ACEPTA_ARCHIVOS, leerArchivo } from './leerArchivo';
import { MetadatosForm, type DatosMetadatos } from './MetadatosForm';
import { PanelAdvertencias } from './PanelAdvertencias';
import { ResumenImportacion } from './ResumenImportacion';
import { TextoCrudoPanel } from './TextoCrudoPanel';
import { useImportacionState } from './useImportacionState';
import { useImportarCedulario } from './useImportarCedulario';

type Paso = 'subir' | 'revisar' | 'confirmar';

interface ImportarCedularioDialogProps {
  /** Universidad preselected when the list is filtered by one. */
  universidadIdInicial: string | null;
  onClose: () => void;
  /** Called with the id of the cedulario that now holds the imported tree. */
  onImported: (cedularioId: string) => void;
}

function sinExtension(nombre: string): string {
  return nombre.replace(/\.[^.]+$/, '').trim();
}

/**
 * Import a cedulario from a PDF / Markdown / text file: upload, review and edit the tree, confirm.
 * Reading and parsing happen in the browser; only the final reviewed tree goes to the server.
 */
export function ImportarCedularioDialog({ universidadIdInicial, onClose, onImported }: ImportarCedularioDialogProps) {
  const t = useTranslations('cedularios.importacion');
  const tc = useTranslations('cedularios');
  const { showError } = useCedulariosAction();
  const universidadesQuery = useUniversidades();
  const cedulariosQuery = useCedularios();
  const universidades = useMemo(() => universidadesQuery.data ?? [], [universidadesQuery.data]);
  const refs = useMemo<UniversidadRef[]>(
    () => universidades.filter((u) => u.activo).map((u) => ({ id: u.id, nombre: u.nombre, codigo: u.codigo })),
    [universidades],
  );

  const importacion = useImportacionState(refs);
  const { estado, planas, advertencias, hayErrores } = importacion;
  const importar = useImportarCedulario({ skipErrorToast: true });
  const [paso, setPaso] = useState<Paso>('subir');
  const [leyendo, setLeyendo] = useState(false);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const arbolRef = useRef<ArbolRevisionHandle>(null);
  const inputId = useId();
  const formId = useId();

  const bloqueado = importar.isPending;

  const procesar = async (archivo: File | undefined) => {
    if (!archivo || leyendo) return;
    setLeyendo(true);
    setErrorLectura(null);
    try {
      const leido = await leerArchivo(archivo);
      importacion.cargar(leido.texto, leido.nombreArchivo);
      setPaso('revisar');
    } catch (error) {
      const codigo = error instanceof ErrorLectura ? error.codigo : 'lectura_fallida';
      setErrorLectura(t(`errores.${codigo}`));
    } finally {
      setLeyendo(false);
    }
  };

  const alSoltar = (evento: DragEvent<HTMLLabelElement>) => {
    evento.preventDefault();
    setArrastrando(false);
    void procesar(evento.dataTransfer.files[0]);
  };

  const cerrar = () => {
    if (!bloqueado) onClose();
  };

  const valoresIniciales = useMemo(
    () => ({
      universidadId: estado.metadatos.universidadId ?? universidadIdInicial ?? '',
      nombre: estado.metadatos.nombre ?? sinExtension(estado.nombreArchivo ?? ''),
      version: estado.metadatos.version ?? '',
    }),
    [estado.metadatos, estado.nombreArchivo, universidadIdInicial],
  );

  const alConfirmar = async ({ cedulario, cedularioId }: DatosMetadatos) => {
    const resultado = await importar.mutateAsync({
      cedulario,
      ...(cedularioId !== null ? { cedulario_id: cedularioId } : {}),
      materias: planas.map((p) => ({ key: p.key, parentKey: p.parentKey, codigo: p.codigo, nombre: p.nombre })),
    });
    if (resultado.ok) {
      onImported(resultado.data.cedulario_id);
      return;
    }
    // The tree stays as the user left it so they can correct it and retry.
    showError(resultado.error);
  };

  const titulosPaso: Record<Paso, string> = {
    subir: t('pasos.subir'),
    revisar: t('pasos.revisar'),
    confirmar: t('pasos.confirmar'),
  };
  const ordenPasos: Paso[] = ['subir', 'revisar', 'confirmar'];

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent
        className="flex max-h-[92dvh] w-full max-w-[calc(100%-1rem)] flex-col gap-3 overflow-hidden border-[var(--color-border)] bg-[var(--color-bg)] sm:max-w-5xl"
        showCloseButton={!bloqueado}
      >
        <DialogHeader>
          <DialogTitle className="font-[var(--font-display)] text-[var(--color-text-primary)]">{t('titulo')}</DialogTitle>
          <DialogDescription className="text-[var(--color-text-muted)]">{t('descripcion')}</DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label={t('pasos.aria')}>
          {ordenPasos.map((p, i) => (
            <li
              key={p}
              aria-current={p === paso ? 'step' : undefined}
              className={cn(
                'rounded-full px-3 py-1 font-medium',
                p === paso
                  ? 'bg-[var(--color-brand-gold)] text-white'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]',
              )}
            >
              {i + 1}. {titulosPaso[p]}
            </li>
          ))}
        </ol>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {paso === 'subir' && (
            <div className="flex flex-col gap-3">
              <label
                htmlFor={inputId}
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={alSoltar}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-3 rounded-[var(--radius-md)] border-2 border-dashed px-4 py-14 text-center transition-colors focus-within:ring-2 focus-within:ring-[var(--color-brand-gold)]',
                  arrastrando
                    ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]',
                )}
              >
                <FileUp className="size-10 text-[var(--color-text-muted)]" aria-hidden="true" />
                <span className="text-base font-medium text-[var(--color-text-primary)]">
                  {leyendo ? t('subir.leyendo') : t('subir.titulo')}
                </span>
                <span className="max-w-md text-sm text-[var(--color-text-muted)]">{t('subir.ayuda')}</span>
                <input
                  id={inputId}
                  type="file"
                  accept={ACEPTA_ARCHIVOS}
                  disabled={leyendo}
                  className="sr-only"
                  onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    e.target.value = '';
                    void procesar(archivo);
                  }}
                />
              </label>
              <p className="text-xs text-[var(--color-text-muted)]">{t('subir.privacidad')}</p>
              {errorLectura !== null && (
                <p role="alert" className="rounded-[var(--radius-sm)] border border-[var(--color-error)] p-3 text-sm text-[var(--color-error)]">
                  {errorLectura}
                </p>
              )}
            </div>
          )}

          {paso === 'revisar' && (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-[var(--color-text-secondary)]">
                    {t('revisar.archivo', { nombre: estado.nombreArchivo ?? '' })}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" icon={<Undo2 className="size-4" aria-hidden="true" />} onClick={importacion.deshacer} disabled={!importacion.puedeDeshacer}>
                      {t('revisar.deshacer')}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" icon={<Redo2 className="size-4" aria-hidden="true" />} onClick={importacion.rehacer} disabled={!importacion.puedeRehacer}>
                      {t('revisar.rehacer')}
                    </Button>
                  </div>
                </div>
                <ArbolRevision
                  handleRef={arbolRef}
                  raiz={estado.raiz}
                  advertencias={advertencias}
                  onOperar={importacion.operar}
                />
              </div>
              {/* Sticky on desktop: the total and the findings stay in view while the tree scrolls.
                  `self-start` is required, a grid item that stretches cannot stick. */}
              <aside
                className="flex min-w-0 flex-col gap-4 md:sticky md:top-0 md:max-h-[calc(92dvh-14rem)] md:self-start md:overflow-y-auto md:border-l md:border-[var(--color-border)] md:pl-4"
                aria-label={t('revisar.panel_aria')}
              >
                <ResumenImportacion planas={planas} />
                <PanelAdvertencias advertencias={advertencias} planas={planas} onIr={(key) => arbolRef.current?.irA(key)} />
                <TextoCrudoPanel texto={estado.texto} onReparsear={importacion.reparsear} />
              </aside>
            </div>
          )}

          {paso === 'confirmar' && (
            <div className="grid gap-6 md:grid-cols-2">
              <MetadatosForm
                formId={formId}
                iniciales={valoresIniciales}
                universidades={universidades}
                cedularios={cedulariosQuery.data ?? []}
                disabled={bloqueado}
                onSubmit={(datos) => void alConfirmar(datos)}
              />
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('confirmar.resumen')}</h3>
                <ResumenImportacion planas={planas} />
                <p className="text-sm text-[var(--color-text-muted)]">{t('confirmar.aviso')}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 sm:justify-between">
          <div>
            {paso !== 'subir' && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ArrowLeft className="size-4" aria-hidden="true" />}
                disabled={bloqueado}
                onClick={() => {
                  if (paso === 'confirmar') setPaso('revisar');
                  else {
                    importacion.reiniciar();
                    setPaso('subir');
                  }
                }}
              >
                {paso === 'revisar' ? t('acciones.otro_archivo') : tc('comun.volver')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" variant="ghost" onClick={cerrar} disabled={bloqueado}>
              {tc('comun.cancelar')}
            </Button>
            {paso === 'revisar' && (
              <Button
                type="button"
                size="sm"
                onClick={() => setPaso('confirmar')}
                disabled={hayErrores || planas.length === 0}
                icon={<ArrowRight className="size-4" aria-hidden="true" />}
              >
                {t('acciones.continuar')}
              </Button>
            )}
            {paso === 'confirmar' && (
              <Button
                type="submit"
                form={formId}
                size="sm"
                loading={importar.isPending}
                disabled={hayErrores || planas.length === 0}
                icon={<Upload className="size-4" aria-hidden="true" />}
              >
                {importar.isPending ? t('acciones.importando') : t('acciones.importar', { count: planas.length })}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
