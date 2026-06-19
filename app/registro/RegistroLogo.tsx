'use client';

import { useTenant } from '@/config/client';
import { AppLogo } from '@/components/common/AppLogo';
import { LogoCompleto } from '@/components/landing/tenants/pregunta-estrategica/LogoCompleto';
import { LogoHorizontal } from '@/components/landing/tenants/pregunta-estrategica/LogoHorizontal';

/**
 * Logo responsive para la página de registro.
 * - Desktop: LogoCompleto (vertical, se ve completo)
 * - Móvil: LogoHorizontal (compacto, no se corta)
 * Solo aplica para tenant pregunta-estrategica; el resto usa AppLogo normal.
 */
export function RegistroLogo() {
  const tenant = useTenant();

  if (tenant.id === 'pregunta-estrategica') {
    return (
      <>
        {/* Desktop: logo completo vertical */}
        <LogoCompleto className="hidden md:block h-[clamp(80px,12vw,130px)] w-auto" />
        {/* Móvil: logo horizontal compacto */}
        <LogoHorizontal className="block md:hidden h-[clamp(36px,10vw,56px)] w-auto" />
      </>
    );
  }

  // Resto de tenants: comportamiento existente
  return (
    <AppLogo
      variant="login"
      style={{ maxHeight: 'clamp(40px, 12vw, 130px)' }}
    />
  );
}
