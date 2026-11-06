'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  CEDULARIOS_I18N_NAMESPACE,
  TIMEOUT_OPERACION_MS,
  mapDbError,
} from '@/lib/cedularios/errors';
import type { ActionError, ActionResult } from '@/lib/cedularios/action-result';

/** Auto-close time of success and error toasts (Requirement 11.12, 11.14). */
export const TOAST_DURATION_MS = 5000;

type I18nValues = Record<string, string | number>;

/** Translator of the `cedularios` namespace. */
export type CedulariosTranslator = (key: string, values?: I18nValues) => string;

type Params = I18nValues;

export interface RunCedulariosActionOptions<T> {
  /**
   * Key under `cedularios.toasts` shown on success (for example `universidad_creada`).
   * No success toast when omitted.
   */
  successKey?: string;
  /** Interpolation params for the success message; a function receives the action data. */
  successParams?: Params | ((data: T) => Params);
  /** Do not show the error toast (the caller shows field errors or its own message). */
  skipErrorToast?: boolean;
  /** Timeout in ms; defaults to `TIMEOUT_OPERACION_MS`. */
  timeoutMs?: number;
}

/**
 * Message for an `ActionError`: `errores.<code>`, or `errores.universidad_con_cedularios_conteo`
 * when the code is `universidad_con_cedularios` and `params.count` is present.
 */
export function mensajeDeError(t: CedulariosTranslator, error: ActionError): string {
  if (error.code === 'universidad_con_cedularios' && error.params?.count !== undefined) {
    return t('errores.universidad_con_cedularios_conteo', error.params);
  }
  return t(`errores.${error.code}`, error.params);
}

/** Message for a field error key (value of `ActionError.fields`), relative to `errores`. */
export function mensajeDeCampo(t: CedulariosTranslator, fieldKey: string): string {
  return t(`errores.${fieldKey}`);
}

const FALLO_TIMEOUT: ActionResult<never> = {
  ok: false,
  error: { code: mapDbError(null, { timeout: true }) },
};

/**
 * Resolves with the action result, or with an `error_conexion` failure after `ms`.
 * The server work is not cancelled. A late result is ignored.
 */
function conTimeout<T>(promesa: Promise<ActionResult<T>>, ms: number): Promise<ActionResult<T>> {
  return new Promise<ActionResult<T>>((resolve) => {
    const temporizador = setTimeout(() => resolve(FALLO_TIMEOUT), ms);
    promesa.then(
      (resultado) => {
        clearTimeout(temporizador);
        resolve(resultado);
      },
      (error: unknown) => {
        clearTimeout(temporizador);
        resolve({ ok: false, error: { code: mapDbError(error) } });
      },
    );
  });
}

export interface UseCedulariosAction {
  /**
   * Runs a Server Action call with a timeout, maps thrown errors, shows the toasts and
   * returns the `ActionResult`. Never throws. Accepts the promise or a function returning it.
   */
  run: <T>(
    accion: Promise<ActionResult<T>> | (() => Promise<ActionResult<T>>),
    options?: RunCedulariosActionOptions<T>,
  ) => Promise<ActionResult<T>>;
  /** Shows the error toast for an `ActionError` (5 s, dismissible). */
  showError: (error: ActionError) => void;
  /** Translated message for an `ActionError`. */
  translateError: (error: ActionError) => string;
  /** Translated message for a field error key, relative to `errores`. */
  translateFieldError: (fieldKey: string) => string;
}

export function useCedulariosAction(): UseCedulariosAction {
  const tNext = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  const t = tNext as unknown as CedulariosTranslator;

  const translateError = useCallback((error: ActionError) => mensajeDeError(t, error), [t]);
  const translateFieldError = useCallback((fieldKey: string) => mensajeDeCampo(t, fieldKey), [t]);

  const showError = useCallback(
    (error: ActionError) => {
      toast.error(mensajeDeError(t, error), {
        duration: TOAST_DURATION_MS,
        dismissible: true,
        closeButton: true,
      });
    },
    [t],
  );

  const run = useCallback(
    async <T>(
      accion: Promise<ActionResult<T>> | (() => Promise<ActionResult<T>>),
      options: RunCedulariosActionOptions<T> = {},
    ): Promise<ActionResult<T>> => {
      let promesa: Promise<ActionResult<T>>;
      try {
        promesa = typeof accion === 'function' ? accion() : accion;
      } catch (error) {
        promesa = Promise.reject(error);
      }

      const resultado = await conTimeout(promesa, options.timeoutMs ?? TIMEOUT_OPERACION_MS);

      if (!resultado.ok) {
        if (!options.skipErrorToast) showError(resultado.error);
        return resultado;
      }

      if (options.successKey) {
        const params =
          typeof options.successParams === 'function'
            ? options.successParams(resultado.data)
            : options.successParams;
        toast.success(t(`toasts.${options.successKey}`, params), {
          duration: TOAST_DURATION_MS,
          dismissible: true,
          closeButton: true,
        });
      }
      return resultado;
    },
    [t, showError],
  );

  return { run, showError, translateError, translateFieldError };
}
