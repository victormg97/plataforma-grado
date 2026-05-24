import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ThemeProvider } from "next-themes";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import { QueryProvider } from "@/lib/queryClient";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { tenantConfig } from "@/config";
import { TenantProvider } from "@/config/client";
import { getTenantFonts } from "@/config/fonts";
import "./globals.css";

const { display: displayFont, body: bodyFont } = getTenantFonts();

/**
 * Genera un objeto de variables CSS a partir de la configuración del tenant.
 * Se usa como inline style en el <html> para inyectar los colores del tenant.
 */
function getTenantCSSVars(): CSSProperties {
  // Only inject tenant-specific custom variables as inline styles.
  // shadcn theme variables (--background, --card, etc.) are handled via <style> tag
  // to preserve light/dark/graduado cascading.
  const vars: Record<string, string> = {
    '--color-brand-gold': tenantConfig.theme.colorAccent,
    '--color-brand-gold-light': tenantConfig.theme.colorAccentLight,
    '--color-brand-gold-muted': tenantConfig.theme.colorAccent + '26',
    '--accent': tenantConfig.theme.colorAccent,
    '--accent-foreground': tenantConfig.theme.colorAccentForeground || '#FFFFFF',
    '--ring': tenantConfig.theme.colorAccent,
    '--sidebar-primary': tenantConfig.theme.colorAccent,
    '--sidebar-primary-foreground': tenantConfig.theme.colorAccentForeground || '#FFFFFF',
    '--sidebar-ring': tenantConfig.theme.colorAccent,
    '--chart-1': tenantConfig.theme.colorAccent,
  };

  return vars as CSSProperties;
}

/**
 * Generates a <style> string for tenant background/theme overrides.
 * Uses CSS selectors (:root and .dark) so they cascade correctly with next-themes.
 */
function getTenantThemeCSS(): string {
  const { theme } = tenantConfig;
  let css = '';

  // Light mode overrides (applied to :root)
  const lightVars: string[] = [];
  if (theme.colorBg) {
    lightVars.push(`--color-bg: ${theme.colorBg}`);
    lightVars.push(`--background: ${theme.colorBg}`);
    lightVars.push(`--popover: ${theme.colorBg}`);
  }
  if (theme.colorCard) {
    lightVars.push(`--color-card: ${theme.colorCard}`);
    lightVars.push(`--card: ${theme.colorCard}`);
    lightVars.push(`--popover: ${theme.colorCard}`);
  } else if (theme.colorBg) {
    lightVars.push(`--card: ${theme.colorBg}`);
  }
  if (theme.colorBgSecondary) {
    lightVars.push(`--color-bg-secondary: ${theme.colorBgSecondary}`);
    lightVars.push(`--secondary: ${theme.colorBgSecondary}`);
    lightVars.push(`--muted: ${theme.colorBgSecondary}`);
    lightVars.push(`--sidebar: ${theme.colorBgSecondary}`);
  }
  if (theme.colorTextPrimary) {
    lightVars.push(`--color-text-primary: ${theme.colorTextPrimary}`);
    lightVars.push(`--foreground: ${theme.colorTextPrimary}`);
    lightVars.push(`--card-foreground: ${theme.colorTextPrimary}`);
  }
  if (theme.colorBorder) {
    lightVars.push(`--color-border: ${theme.colorBorder}`);
    lightVars.push(`--border: ${theme.colorBorder}`);
    lightVars.push(`--input: ${theme.colorBorder}`);
  }
  if (lightVars.length > 0) {
    css += `:root { ${lightVars.join('; ')}; }\n`;
  }

  // Dark mode overrides
  if (theme.dark) {
    const darkVars: string[] = [];
    if (theme.dark.colorBg) {
      darkVars.push(`--color-bg: ${theme.dark.colorBg}`);
      darkVars.push(`--background: ${theme.dark.colorBg}`);
      darkVars.push(`--popover: ${theme.dark.colorBg}`);
    }
    if (theme.dark.colorCard) {
      darkVars.push(`--color-card: ${theme.dark.colorCard}`);
      darkVars.push(`--card: ${theme.dark.colorCard}`);
      darkVars.push(`--popover: ${theme.dark.colorCard}`);
    } else if (theme.dark.colorBg) {
      darkVars.push(`--card: ${theme.dark.colorBg}`);
    }
    if (theme.dark.colorBgSecondary) {
      darkVars.push(`--color-bg-secondary: ${theme.dark.colorBgSecondary}`);
      darkVars.push(`--secondary: ${theme.dark.colorBgSecondary}`);
      darkVars.push(`--muted: ${theme.dark.colorBgSecondary}`);
      darkVars.push(`--sidebar: ${theme.dark.colorBgSecondary}`);
    }
    if (theme.dark.colorTextPrimary) {
      darkVars.push(`--color-text-primary: ${theme.dark.colorTextPrimary}`);
      darkVars.push(`--foreground: ${theme.dark.colorTextPrimary}`);
      darkVars.push(`--card-foreground: ${theme.dark.colorTextPrimary}`);
      darkVars.push(`--popover-foreground: ${theme.dark.colorTextPrimary}`);
    }
    if (theme.dark.colorBorder) {
      darkVars.push(`--color-border: ${theme.dark.colorBorder}`);
      darkVars.push(`--border: ${theme.dark.colorBorder}`);
      darkVars.push(`--input: ${theme.dark.colorBorder}`);
    }
    if (darkVars.length > 0) {
      css += `.dark { ${darkVars.join('; ')}; }\n`;
    }
  }

  return css;
}

export const metadata: Metadata = {
  title: `${tenantConfig.nombre} — ${tenantConfig.descripcion}`,
  description: tenantConfig.descripcion,
  icons: {
    icon: tenantConfig.metadata?.favicon || '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}
      style={getTenantCSSVars()}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-body)" }} suppressHydrationWarning>
        {/* Inject tenant theme overrides via CSS (respects light/dark cascading) */}
        {getTenantThemeCSS() && (
          <style dangerouslySetInnerHTML={{ __html: getTenantThemeCSS() }} />
        )}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} themes={['light', 'dark', 'graduado']}>
          <QueryProvider>
            <NextIntlClientProvider messages={messages}>
              <TenantProvider config={tenantConfig}>
                {children}
              </TenantProvider>
              <Toaster position="top-right" richColors />
              <SpeedInsights />
              <Analytics />
            </NextIntlClientProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
