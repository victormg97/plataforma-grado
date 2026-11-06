'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useCedulariosUrlState, type CedulariosUrlState } from './useCedulariosUrlState';

/**
 * `useShallowQueryParam` keeps a separate copy of its state per hook instance, so two components
 * that each call `useCedulariosUrlState` can disagree. Only `CedulariosUrlProvider`, mounted once
 * at the root of the module, calls it. Every other component reads the shared state with
 * `useCedulariosUrl`.
 */
const CedulariosUrlContext = createContext<CedulariosUrlState | null>(null);

export function CedulariosUrlProvider({ children }: { children: ReactNode }) {
  const state = useCedulariosUrlState();
  return <CedulariosUrlContext.Provider value={state}>{children}</CedulariosUrlContext.Provider>;
}

/** URL state of the module. Throws when used outside `CedulariosUrlProvider`. */
export function useCedulariosUrl(): CedulariosUrlState {
  const state = useContext(CedulariosUrlContext);
  if (state === null) {
    throw new Error(
      'useCedulariosUrl must be used inside <CedulariosUrlProvider>. ' +
        'Mount the provider once at the root of the cedularios module.',
    );
  }
  return state;
}
