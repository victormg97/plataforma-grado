'use client';

import { useRouter } from 'next/navigation';
import { Menu, LogOut, UserCog } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Avatar } from '@/components/common/Avatar';
import { NotificacionesPanel } from '@/components/layout/Navbar/NotificacionesPanel';
import { useUIStore } from '@/stores/useUIStore';
import { useUserStore } from '@/stores/useUserStore';
import { useTenant } from '@/config/client';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Navbar() {
  const { toggleSidebar } = useUIStore();
  const { user, clearUser } = useUserStore();
  const tenant = useTenant();
  const router = useRouter();
  const t = useTranslations('perfil');
  const ta = useTranslations('auth');

  async function handleLogout() {
    try {
      await Promise.race([
        fetch('/api/auth/signout', { method: 'POST' }),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch { /* ignore */ }
    clearUser();
    window.location.href = '/login';
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--container-padding)]">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="size-5" />
        </button>
        <span
          className="hidden text-lg font-bold text-[var(--color-text-primary)] sm:block"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {tenant.nombre}
        </span>
      </div>

      {/* Right: notifications, theme, profile */}
      <div className="flex items-center gap-2">
        {user && <NotificacionesPanel />}

        <ThemeToggle />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-[var(--radius-md)] p-1 transition-colors hover:bg-[var(--color-bg-secondary)]">
              <Avatar
                nombre={user.nombre}
                apellido={user.apellido}
                avatarUrl={user.avatar_url}
                size="sm"
              />
              <span className="hidden text-sm font-medium text-[var(--color-text-primary)] md:block">
                {user.nombre}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">
                  {user.nombre} {user.apellido}
                  {user.apellido_materno ? ` ${user.apellido_materno.charAt(0).toUpperCase()}.` : ''}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push('/perfil')}
                className="cursor-pointer"
              >
                <UserCog className="mr-2 size-4" />
                {t('editar_perfil')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-[var(--color-error)] focus:text-[var(--color-error)]"
              >
                <LogOut className="mr-2 size-4" />
                {ta('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
