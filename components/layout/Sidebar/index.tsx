'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/useUIStore';
import { useUserStore } from '@/stores/useUserStore';
import { AppLogo } from '@/components/common/AppLogo';
import { AppInfoPopover } from '@/components/common/AppInfoPopover';
import { useTenant } from '@/config/client';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Calendar,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  User,
  FolderOpen,
  X,
  CreditCard,
} from 'lucide-react';
import type { UserRol } from '@/lib/supabase/types';

interface NavItem {
  key: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: Record<UserRol, NavItem[]> = {
  admin: [
    { key: 'dashboard', href: '/admin', icon: <LayoutDashboard className="size-4" /> },
    { key: 'agenda', href: '/admin/agenda', icon: <Calendar className="size-4" /> },
    { key: 'profesores', href: '/admin/profesores', icon: <BookOpen className="size-4" /> },
    { key: 'alumnos', href: '/admin/alumnos', icon: <GraduationCap className="size-4" /> },
    { key: 'programas', href: '/admin/programas', icon: <ClipboardList className="size-4" /> },
    { key: 'pagos', href: '/admin/pagos', icon: <CreditCard className="size-4" /> },
  ],
  profesor: [
    { key: 'dashboard', href: '/profesor', icon: <LayoutDashboard className="size-4" /> },
    { key: 'agenda', href: '/profesor/agenda', icon: <Calendar className="size-4" /> },
    { key: 'mis_alumnos', href: '/profesor/mis-alumnos', icon: <Users className="size-4" /> },
    { key: 'horarios', href: '/profesor/horarios', icon: <BookOpen className="size-4" /> },
    { key: 'programas', href: '/profesor/programas', icon: <ClipboardList className="size-4" /> },
  ],
  alumno: [
    { key: 'mis_clases', href: '/alumno', icon: <LayoutDashboard className="size-4" /> },
    { key: 'agenda', href: '/alumno/agenda', icon: <Calendar className="size-4" /> },
    { key: 'horario', href: '/alumno/horario', icon: <GraduationCap className="size-4" /> },
    { key: 'perfil', href: '/alumno/perfil', icon: <User className="size-4" /> },
  ],
  // Lector: no tiene sección principal aparte de recursos, el nav queda vacío
  // y recursos aparece en la sección inferior destacada.
  lector: [],
};

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { user } = useUserStore();
  const tenant = useTenant();
  const t = useTranslations('nav');

  const items = user ? navItems[user.rol] : [];

  const sharedFilesHref =
    user?.rol === 'admin'
      ? '/admin/recursos'
      : user?.rol === 'profesor'
      ? '/profesor/recursos'
      : user?.rol === 'lector'
      ? '/lector/recursos'
      : '/alumno/recursos';

  const isSharedFilesActive = pathname.startsWith(sharedFilesHref);

  return (
    <>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          role="presentation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)] transition-transform lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="relative flex h-16 items-center justify-center border-b border-[var(--color-border)] px-4">
          <Link href="/">
            <AppLogo variant="sidebar" />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute right-4 lg:hidden text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto space-y-1 p-3">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
                )}
              >
                {item.icon}
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        {/* Shared Files */}
        <div className="border-t border-[var(--color-border)] p-3">
          <Link
            href={sharedFilesHref}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors',
              isSharedFilesActive
                ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
            )}
          >
            <FolderOpen className="size-4" />
            {t('recursos')}
          </Link>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">{tenant.nombre}</span>
            <AppInfoPopover />
          </div>
        </div>
      </aside>
    </>
  );
}
