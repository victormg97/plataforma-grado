'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { TenantConfig } from './schema';

const TenantContext = createContext<TenantConfig | null>(null);

export function TenantProvider({
  config,
  children,
}: {
  config: TenantConfig;
  children: ReactNode;
}) {
  return (
    <TenantContext.Provider value={config}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantConfig {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant debe usarse dentro de TenantProvider');
  }
  return ctx;
}
