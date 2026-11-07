'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SEG_BUSQUEDA_DEBOUNCE_MS,
  SEG_BUSQUEDA_MAX,
} from '@/lib/cedularios/seguimiento/constants';
import { useSegUrl } from '../url/useSegUrl';

export interface UseBusquedaSegUrlResult {
  /** Text shown in the input (updates on every keystroke). */
  texto: string;
  /** Updates the input text now and writes `seg_q` after the debounce. */
  setTexto: (valor: string) => void;
  /** Clears the input and `seg_q` right away, cancelling any pending write. */
  limpiar: () => void;
}

/**
 * Search input state of the Revisor tree.
 * The input keeps a local text so typing is never blocked; `seg_q` is written through
 * `useSegUrl` 300 ms after the last keystroke. When `seg_q` changes from outside
 * (clear filters, switching student) the input follows the URL.
 */
export function useBusquedaSegUrl(): UseBusquedaSegUrlResult {
  const { estado, fijar } = useSegUrl();
  const [texto, setTextoLocal] = useState(estado.q);
  const [qPrevia, setQPrevia] = useState(estado.q);
  // Last value this hook wrote, used to tell our own URL updates from external ones.
  const [escrita, setEscrita] = useState(estado.q);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow external changes of seg_q (derived state, adjusted during render).
  if (estado.q !== qPrevia) {
    setQPrevia(estado.q);
    if (estado.q !== escrita) {
      setTextoLocal(estado.q);
      setEscrita(estado.q);
    }
  }

  const cancelar = useCallback(() => {
    if (temporizador.current !== null) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  }, []);

  useEffect(() => cancelar, [cancelar]);

  const setTexto = useCallback(
    (valor: string) => {
      const recortado = valor.slice(0, SEG_BUSQUEDA_MAX);
      setTextoLocal(recortado);
      cancelar();
      temporizador.current = setTimeout(() => {
        temporizador.current = null;
        setEscrita(recortado);
        fijar({ q: recortado });
      }, SEG_BUSQUEDA_DEBOUNCE_MS);
    },
    [cancelar, fijar],
  );

  const limpiar = useCallback(() => {
    cancelar();
    setTextoLocal('');
    setEscrita('');
    fijar({ q: '' });
  }, [cancelar, fijar]);

  return { texto, setTexto, limpiar };
}
