'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/useUIStore';
import { useUserStore } from '@/stores/useUserStore';
import { AppLogo } from '@/components/common/AppLogo';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Calendar,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  User,
  X,
} from 'lucide-react';
import type { UserRol } from '@/lib/supabase/types';

interface NavItem {
  key: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: Record<UserRol, NavItem[]> = {
  admin: [
    { key: 'dashboard', href: '/admin', icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: 'agenda', href: '/admin/agenda', icon: <Calendar className="h-4 w-4" /> },
    { key: 'profesores', href: '/admin/profesores', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'alumnos', href: '/admin/alumnos', icon: <GraduationCap className="h-4 w-4" /> },
    { key: 'programas', href: '/admin/programas', icon: <ClipboardList className="h-4 w-4" /> },
  ],
  profesor: [
    { key: 'dashboard', href: '/profesor', icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: 'agenda', href: '/profesor/agenda', icon: <Calendar className="h-4 w-4" /> },
    { key: 'mis_alumnos', href: '/profesor/mis-alumnos', icon: <Users className="h-4 w-4" /> },
    { key: 'horarios', href: '/profesor/horarios', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'programas', href: '/profesor/programas', icon: <ClipboardList className="h-4 w-4" /> },
  ],
  alumno: [
    { key: 'mis_clases', href: '/alumno', icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: 'agenda', href: '/alumno/agenda', icon: <Calendar className="h-4 w-4" /> },
    { key: 'horario', href: '/alumno/horario', icon: <GraduationCap className="h-4 w-4" /> },
    { key: 'perfil', href: '/alumno/perfil', icon: <User className="h-4 w-4" /> },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { user } = useUserStore();
  const t = useTranslations('nav');

  const items = user ? navItems[user.rol] : [];

  return (
    <>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)] transition-transform lg:static lg:translate-x-0',
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
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
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

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] p-3">
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            CTA Graduados v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
