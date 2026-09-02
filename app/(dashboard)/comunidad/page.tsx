'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import { useGameSettings } from '@/lib/hooks/useComunidad';
import { GameThemeScope } from '@/components/comunidad/GameThemeScope';
import { GameShell } from '@/components/comunidad/GameShell';

/**
 * Entry page for the "Comunidad Estratégica" mini-app. Client-side access
 * guard mirrors the backend RLS rule:
 *   accessible = game_enabled && (all_users || (admin_only && rol === 'admin'))
 * If not accessible, redirect to the role's default page.
 */
export default function ComunidadPage() {
  const router = useRouter();
  const { user } = useUser();
  const { data: settings, isLoading } = useGameSettings();

  const accessible =
    !!settings &&
    settings.game_enabled &&
    (settings.game_visibility === 'all_users' ||
      (settings.game_visibility === 'admin_only' && user?.rol === 'admin'));

  useEffect(() => {
    if (!isLoading && settings && user && !accessible) {
      router.replace(getRolRedirectPath(user.rol));
    }
  }, [isLoading, settings, user, accessible, router]);

  if (isLoading || !user) {
    return (
      <div className="flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
      </div>
    );
  }

  if (!accessible) return null;

  return (
    <GameThemeScope>
      <GameShell />
    </GameThemeScope>
  );
}
