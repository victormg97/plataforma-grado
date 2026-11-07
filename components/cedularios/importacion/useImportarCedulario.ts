'use client';

import { useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { importarCedulario } from '@/app/actions/cedularios/importacion';
import type { ActionResult } from '@/lib/cedularios/action-result';
import type { ImportacionInput } from '@/lib/cedularios/importacion/schema';
import { cedulariosKeys } from '@/lib/cedularios/keys';
import { useAccionMutation, type CedulariosMutationOptions } from '../hooks/useAccionMutation';

/** Sends the reviewed tree to the server (one transaction) and refreshes the module caches. */
export function useImportarCedulario(
  options?: CedulariosMutationOptions,
): UseMutationResult<ActionResult<{ cedulario_id: string }>, Error, ImportacionInput> {
  const qc = useQueryClient();
  return useAccionMutation<ImportacionInput, { cedulario_id: string }>({
    action: (input) => importarCedulario(input),
    successKey: 'cedulario_importado',
    onOk: () => {
      void qc.invalidateQueries({ queryKey: cedulariosKeys.all });
    },
    options,
  });
}
