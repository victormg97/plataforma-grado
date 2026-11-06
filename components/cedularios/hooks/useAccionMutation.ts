'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { ActionResult } from '@/lib/cedularios/action-result';
import { useCedulariosAction } from './useCedulariosAction';

/** Options accepted by every mutation hook of the module. */
export interface CedulariosMutationOptions {
  /**
   * Do not show the error toast. Use it in forms that show field errors
   * (`result.error.fields`) or their own message.
   */
  skipErrorToast?: boolean;
  /** Do not show the success toast (autosave, or callers that show their own, like the undo toast). */
  skipSuccessToast?: boolean;
}

type I18nParams = Record<string, string | number>;

interface AccionMutationConfig<TVars, TData> {
  action: (vars: TVars) => Promise<ActionResult<TData>>;
  /** Key under `cedularios.toasts`. */
  successKey?: string;
  successParams?: (data: TData, vars: TVars) => I18nParams;
  /** Runs after an `ok` result: cache patches and invalidations. Not awaited. */
  onOk?: (data: TData, vars: TVars) => void;
  options?: CedulariosMutationOptions;
}

/**
 * Wraps a Server Action in `useMutation` through `useCedulariosAction().run`
 * (30 s timeout, error toast, success toast). The mutation always resolves with the
 * `ActionResult` (it never rejects), so callers read `result.ok` / `result.error.fields`.
 */
export function useAccionMutation<TVars, TData>(
  config: AccionMutationConfig<TVars, TData>,
): UseMutationResult<ActionResult<TData>, Error, TVars> {
  const { run } = useCedulariosAction();
  const { action, successKey, successParams, onOk, options } = config;

  return useMutation<ActionResult<TData>, Error, TVars>({
    mutationFn: (vars) =>
      run(() => action(vars), {
        successKey: options?.skipSuccessToast ? undefined : successKey,
        successParams: successParams ? (data: TData) => successParams(data, vars) : undefined,
        skipErrorToast: options?.skipErrorToast,
      }),
    onSuccess: (result, vars) => {
      if (result.ok) onOk?.(result.data, vars);
    },
  });
}
