import { Playfair_Display, DM_Sans, Inter, Lora, Montserrat, Open_Sans, Poppins, Roboto, Raleway, Merriweather } from 'next/font/google';
import { tenantConfig } from '@/config';

// ─── Pre-registered font instances (static strings required by next/font/google) ─

const playfairDisplay = Playfair_Display({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
});

const dmSans = DM_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

const lora = Lora({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
});

const montserrat = Montserrat({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

const openSans = Open_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

const poppins = Poppins({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const roboto = Roboto({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

const raleway = Raleway({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
});

const merriweather = Merriweather({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '700', '900'],
});

// ─── Font registry: maps Google Font names to their instances ─────────────────

type FontInstance = typeof playfairDisplay;

const displayFontsMap: Record<string, FontInstance> = {
  'Playfair Display': playfairDisplay,
  'Lora': lora,
  'Raleway': raleway,
  'Merriweather': merriweather,
  'Montserrat': montserrat,
};

const bodyFontsMap: Record<string, FontInstance> = {
  'DM Sans': dmSans,
  'Inter': inter,
  'Open Sans': openSans,
  'Poppins': poppins,
  'Roboto': roboto,
  'Montserrat': montserrat,
};

// ─── Font resolution ─────────────────────────────────────────────────────────

export interface TenantFonts {
  display: FontInstance;
  body: FontInstance;
}

/**
 * Resuelve las fuentes del tenant activo.
 * Si el tenant no define fuentes o la fuente no está en el registro,
 * se usan Playfair Display (display) y DM Sans (body) por defecto.
 */
export function getTenantFonts(): TenantFonts {
  const displayName = tenantConfig.fonts?.display || 'Playfair Display';
  const bodyName = tenantConfig.fonts?.body || 'DM Sans';

  const display = displayFontsMap[displayName] || playfairDisplay;
  const body = bodyFontsMap[bodyName] || dmSans;

  return { display, body };
}

/** Lista de fuentes display soportadas */
export const supportedDisplayFonts = Object.keys(displayFontsMap);

/** Lista de fuentes body soportadas */
export const supportedBodyFonts = Object.keys(bodyFontsMap);
