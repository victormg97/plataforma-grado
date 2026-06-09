import { tenantConfig } from '@/config';

interface LandingFooterProps {
  /** Texto de derechos reservados (ya traducido por el tenant) */
  derechos: string;
}

/**
 * Footer compartido del landing. Tenant-agnóstico: recibe el texto traducido
 * como prop. Un tenant que quiera un footer distinto puede no usarlo y
 * renderizar el suyo propio.
 */
export function LandingFooter({ derechos }: LandingFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--color-brand-gold)] text-white">
      <div className="container-landing flex flex-col items-center justify-between gap-2 py-6 text-center text-sm sm:flex-row sm:text-left">
        <span style={{ fontFamily: 'var(--font-display)' }}>{tenantConfig.nombre}</span>
        <span className="text-white/80">
          © {year} {tenantConfig.nombre}. {derechos}
        </span>
      </div>
    </footer>
  );
}
