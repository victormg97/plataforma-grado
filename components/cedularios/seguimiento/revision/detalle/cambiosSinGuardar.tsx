'use client';

/**
 * Tracks whether any form of the materia detail panel holds unsaved text.
 *
 * The panel renders `CambiosSinGuardarProvider`; every form inside (note, new comment, comment
 * edit, new repaso, repaso edit) calls `useRegistrarCambios(isDirty)`. The provider reports the
 * aggregate through `onChange`, so the Revisor can ask before closing the panel or switching to
 * another materia.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type Registrar = (id: string, sucio: boolean) => void;

const CambiosContext = createContext<Registrar | null>(null);

interface CambiosSinGuardarProviderProps {
  /** Called with `true` when at least one form has unsaved text, `false` when none has. */
  onChange?: (hayCambios: boolean) => void;
  children: ReactNode;
}

export function CambiosSinGuardarProvider({ onChange, children }: CambiosSinGuardarProviderProps) {
  const [sucios, setSucios] = useState<ReadonlySet<string>>(() => new Set());

  const registrar = useCallback<Registrar>((id, sucio) => {
    setSucios((previos) => {
      if (previos.has(id) === sucio) return previos;
      const siguientes = new Set(previos);
      if (sucio) siguientes.add(id);
      else siguientes.delete(id);
      return siguientes;
    });
  }, []);

  const hayCambios = sucios.size > 0;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current?.(hayCambios);
  }, [hayCambios]);

  // When the panel unmounts its forms are gone: nothing is pending any more.
  useEffect(() => () => onChangeRef.current?.(false), []);

  const valor = useMemo(() => registrar, [registrar]);
  return <CambiosContext.Provider value={valor}>{children}</CambiosContext.Provider>;
}

/** Reports whether the calling form has unsaved text. A no-op outside the provider. */
export function useRegistrarCambios(sucio: boolean): void {
  const registrar = useContext(CambiosContext);
  const id = useId();

  useEffect(() => {
    registrar?.(id, sucio);
  }, [registrar, id, sucio]);

  // An unmounted form (edit cancelled, item removed) no longer holds unsaved text.
  useEffect(() => () => registrar?.(id, false), [registrar, id]);
}
