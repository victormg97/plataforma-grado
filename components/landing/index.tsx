import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { tenantConfig } from '@/config';
import type { LandingProps } from './types';

/**
 * Secciones del landing que pueden tener URL propia. Cada una se renderiza
 * DENTRO de la página principal (scroll continuo) con un id de ancla; la ruta
 * homónima (ej. "/sobre-nosotras") simplemente lleva a "/landing#<ancla>".
 */
export type LandingSection = 'programas' | 'tutorias' | 'planes' | 'sobre-nosotras' | 'contacto';

interface TenantLanding {
  /** Componente de la página principal (ensambla todas las secciones). */
  home: ComponentType<LandingProps>;
  /**
   * Secciones con URL propia que existen dentro del home. La ruta
   * correspondiente redirige a "/landing#<seccion>".
   */
  sections: LandingSection[];
}

/**
 * Registro de landing pages por tenant.
 *
 * Cada tenant con landing registra aquí su página principal y las secciones
 * con URL propia. El código se carga de forma dinámica, de modo que solo entra
 * al bundle el del tenant activo.
 *
 * Para añadir un tenant nuevo:
 *   1. Crea `components/landing/tenants/<tenantId>/Home.tsx` (export default,
 *      recibe LandingProps) que ensamble sus secciones.
 *   2. Crea sus mensajes i18n: `messages/pages/<locale>/landing-<tenantId>.json`.
 *   3. Regístralo en este mapa con sus secciones.
 */
const landingRegistry: Record<string, TenantLanding> = {
  'pregunta-estrategica': {
    home: dynamic(() => import('./tenants/pregunta-estrategica/Home')),
    sections: ['programas', 'tutorias', 'planes', 'sobre-nosotras', 'contacto'],
  },
};

/**
 * Devuelve true si el tenant activo tiene página principal de landing.
 */
export function tenantHasLanding(): boolean {
  return Boolean(landingRegistry[tenantConfig.id]?.home);
}

/**
 * Devuelve true si el tenant activo tiene una sección con URL propia.
 */
export function tenantHasSection(section: LandingSection): boolean {
  return Boolean(landingRegistry[tenantConfig.id]?.sections.includes(section));
}

/**
 * Renderiza la página principal del landing del tenant activo. Devuelve null
 * si el tenant no tiene landing (la ruta debe manejar el fallback).
 */
export function TenantLandingHome(props: LandingProps) {
  const Home = landingRegistry[tenantConfig.id]?.home;
  if (!Home) return null;
  return <Home {...props} />;
}
