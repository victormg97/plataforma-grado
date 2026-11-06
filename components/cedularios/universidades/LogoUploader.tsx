'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
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

interface LogoUploaderProps {
  /**
   * The saved universidad. `null` while it is being created: the logo can only be uploaded for an
   * existing universidad, so the control is disabled and explains why.
   */
  universidad: Pick<Universidad, 'id' | 'nombre' | 'logo_url'> | null;
}

/**
 * Logo picker (Requirements 1.4, 1.5, 1.6). Validates type and size in the browser, uploads the
 * file straight to the public `cedularios-logos` bucket at `<universidad_id>/<uuid>.<ext>`, then
 * stores the URL through `useGuardarLogoUniversidad`. If storing the URL fails, the new object is
 * removed (best effort) and the previous logo stays.
 */
export function LogoUploader({ universidad }: LogoUploaderProps) {
  const t = useTranslations('cedularios');
  const guardar = useGuardarLogoUniversidad();
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

  const mostrarErrorSubida = () => {
    toast.error(t('universidades.logo.error_subida'), {
      duration: TOAST_DURATION_MS,
      dismissible: true,
      closeButton: true,
    });
  };

  const alElegirArchivo = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    // Lets the user pick the same file again after an error.
    evento.target.value = '';
    if (!archivo || !universidad || subiendo) return;

    const validacion = validarLogo(archivo);
    if (!validacion.ok) {
      setErrorCode(validacion.code);
      return;
    }
    setErrorCode(null);

    const urlPreview = URL.createObjectURL(archivo);
    previewRef.current = urlPreview;
    setPreview(urlPreview);
    setSubiendo(true);

    const supabase = createClient();
    let rutaSubida: string | null = null;

    try {
      const mime = archivo.type.trim().toLowerCase() as LogoMime;
      const ruta = `${universidad.id}/${crypto.randomUUID()}.${LOGO_EXTENSION_POR_MIME[mime]}`;

      const { error } = await supabase.storage.from(BUCKET_LOGOS).upload(ruta, archivo, {
        contentType: mime,
        cacheControl: '3600',
        upsert: false,
      });
      if (error) {
        mostrarErrorSubida();
        return;
      }
      rutaSubida = ruta;

      const resultado = await guardar.mutateAsync({ id: universidad.id, path: ruta });
      if (resultado.ok) {
        rutaSubida = null;
        setUrlGuardada(resultado.data.logo_url);
      }
      // On failure the hook already showed the error toast; the previous logo_url is unchanged.
    } catch {
      mostrarErrorSubida();
    } finally {
      if (rutaSubida !== null) {
        try {
          await supabase.storage.from(BUCKET_LOGOS).remove([rutaSubida]);
        } catch {
          // Best effort: an orphan object does not affect the stored logo.
        }
      }
      URL.revokeObjectURL(urlPreview);
      previewRef.current = null;
      setPreview(null);
      setSubiendo(false);
    }
  };

  const logoActual = preview ?? urlGuardada ?? universidad?.logo_url ?? null;
  const tieneLogo = (urlGuardada ?? universidad?.logo_url ?? null) !== null;
  const deshabilitado = universidad === null || subiendo;

  const etiquetaBoton = subiendo
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
            loading={subiendo}
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
            {universidad === null
              ? t('universidades.logo.guardar_universidad_primero')
              : t('universidades.logo.formatos')}
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
