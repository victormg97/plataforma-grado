'use client';

import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/common/Button';
import { createClient } from '@/lib/supabase/client';
import {
  LOGO_EXTENSION_POR_MIME,
  LOGO_MIME_PERMITIDOS,
  validarLogo,
  type LogoErrorCode,
  type LogoMime,
} from '@/lib/cedularios/schemas';
import type { Universidad } from '@/lib/queries/cedularios/universidades';
import { useGuardarLogoUniversidad } from '../hooks/useUniversidades';
import { TOAST_DURATION_MS } from '../hooks/useCedulariosAction';
import { UniversidadLogo } from './UniversidadLogo';

const BUCKET_LOGOS = 'cedularios-logos';
const ACCEPT = LOGO_MIME_PERMITIDOS.join(',');

/**
 * Uploads a logo file for an existing universidad: the file goes straight to the public
 * `cedularios-logos` bucket at `<universidad_id>/<uuid>.<ext>`, then the URL is stored through
 * `useGuardarLogoUniversidad`. If storing the URL fails, the new object is removed (best effort)
 * and the previous logo stays. Resolves to the stored URL, or `null` when anything failed (an
 * error toast has already been shown).
 */
export function useSubirLogoUniversidad() {
  const t = useTranslations('cedularios');
  const guardar = useGuardarLogoUniversidad();
  const { mutateAsync } = guardar;

  const subir = useCallback(
    async (universidadId: string, archivo: File): Promise<string | null> => {
      const mostrarErrorSubida = () => {
        toast.error(t('universidades.logo.error_subida'), {
          duration: TOAST_DURATION_MS,
          dismissible: true,
          closeButton: true,
        });
      };

      const supabase = createClient();
      let rutaSubida: string | null = null;
      try {
        const mime = archivo.type.trim().toLowerCase() as LogoMime;
        const ruta = `${universidadId}/${crypto.randomUUID()}.${LOGO_EXTENSION_POR_MIME[mime]}`;

        const { error } = await supabase.storage.from(BUCKET_LOGOS).upload(ruta, archivo, {
          contentType: mime,
          cacheControl: '3600',
          upsert: false,
        });
        if (error) {
          mostrarErrorSubida();
          return null;
        }
        rutaSubida = ruta;

        const resultado = await mutateAsync({ id: universidadId, path: ruta });
        if (resultado.ok) {
          rutaSubida = null;
          return resultado.data.logo_url;
        }
        // The hook already showed the error toast; the previous logo_url is unchanged.
        return null;
      } catch {
        mostrarErrorSubida();
        return null;
      } finally {
        if (rutaSubida !== null) {
          try {
            await supabase.storage.from(BUCKET_LOGOS).remove([rutaSubida]);
          } catch {
            // Best effort: an orphan object does not affect the stored logo.
          }
        }
      }
    },
    [mutateAsync, t],
  );

  return { subir, subiendo: guardar.isPending };
}

interface LogoUploaderProps {
  /**
   * The saved universidad. `null` while it is being created: the chosen file is then only kept in
   * the form (`onArchivoChange`) and uploaded right after the universidad is created.
   */
  universidad: Pick<Universidad, 'id' | 'nombre' | 'logo_url'> | null;
  /** Create mode only: receives the validated file the user picked (the form uploads it later). */
  onArchivoChange?: (archivo: File | null) => void;
  /** Disables the picker, for example while the form is being saved. */
  disabled?: boolean;
}

/**
 * Logo picker (Requirements 1.4, 1.5, 1.6). Validates type and size in the browser.
 *
 * Editing: the file is uploaded and saved as soon as it is chosen. Creating: the file is only
 * previewed and handed to the form through `onArchivoChange`, which uploads it once the
 * universidad exists.
 */
export function LogoUploader({ universidad, onArchivoChange, disabled = false }: LogoUploaderProps) {
  const t = useTranslations('cedularios');
  const { subir, subiendo: guardandoUrl } = useSubirLogoUniversidad();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const mensajeId = useId();

  const [preview, setPreview] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<LogoErrorCode | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  // Logo URL returned by the last successful save, shown until the universidades query refetches.
  const [urlGuardada, setUrlGuardada] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const cambiarPreview = (nueva: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = nueva;
    setPreview(nueva);
  };

  const alElegirArchivo = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    // Lets the user pick the same file again after an error.
    evento.target.value = '';
    if (!archivo || subiendo) return;

    const validacion = validarLogo(archivo);
    if (!validacion.ok) {
      setErrorCode(validacion.code);
      return;
    }
    setErrorCode(null);

    // Create mode: keep the file for the form and show it as a preview.
    if (!universidad) {
      cambiarPreview(URL.createObjectURL(archivo));
      onArchivoChange?.(archivo);
      return;
    }

    // Edit mode: upload now.
    cambiarPreview(URL.createObjectURL(archivo));
    setSubiendo(true);
    try {
      const url = await subir(universidad.id, archivo);
      if (url !== null) setUrlGuardada(url);
    } finally {
      cambiarPreview(null);
      setSubiendo(false);
    }
  };

  const logoActual = preview ?? urlGuardada ?? universidad?.logo_url ?? null;
  const tieneLogo = preview !== null || (urlGuardada ?? universidad?.logo_url ?? null) !== null;
  const ocupado = subiendo || guardandoUrl;
  const deshabilitado = disabled || ocupado;

  const etiquetaBoton = ocupado
    ? t('universidades.logo.subiendo')
    : tieneLogo
      ? t('universidades.logo.cambiar')
      : t('universidades.logo.subir');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <UniversidadLogo
          url={logoActual}
          nombre={universidad?.nombre ?? ''}
          className="size-20"
        />
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Upload className="size-4" aria-hidden="true" />}
            loading={ocupado}
            disabled={deshabilitado}
            aria-describedby={mensajeId}
            onClick={() => inputRef.current?.click()}
          >
            {etiquetaBoton}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-label={t('universidades.campos.logo')}
            disabled={deshabilitado}
            onChange={alElegirArchivo}
          />
          <p id={mensajeId} className="text-xs text-[var(--color-text-muted)]">
            {t('universidades.logo.formatos')}
          </p>
        </div>
      </div>
      {errorCode !== null && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {t(`errores.${errorCode}`)}
        </p>
      )}
    </div>
  );
}
