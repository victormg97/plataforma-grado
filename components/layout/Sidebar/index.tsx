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
import { useQuery } from '@tanstack/react-query';
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
  BookMarked,
  Link2,
} from 'lucide-react';
import type { UserRol } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/client';

interface NavItem {
  key: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: Record<UserRol, NavItem[]> = {
  admin: [
    { key: 'dashboard',  href: '/admin',            icon: <LayoutDashboard className="size-4" /> },
    { key: 'agenda',     href: '/admin/agenda',      icon: <Calendar className="size-4" /> },
    { key: 'profesores', href: '/admin/profesores',  icon: <BookOpen className="size-4" /> },
    { key: 'alumnos',    href: '/admin/alumnos',     icon: <GraduationCap className="size-4" /> },
    // 'lectores' se inserta dinámicamente si hay lectores registrados
    { key: 'programas',  href: '/admin/programas',   icon: <ClipboardList className="size-4" /> },
    { key: 'pagos',      href: '/admin/pagos',       icon: <CreditCard className="size-4" /> },
  ],
  profesor: [
    { key: 'dashboard',   href: '/profesor',              icon: <LayoutDashboard className="size-4" /> },
    { key: 'agenda',      href: '/profesor/agenda',       icon: <Calendar className="size-4" /> },
    { key: 'mis_alumnos', href: '/profesor/mis-alumnos',  icon: <Users className="size-4" /> },
    { key: 'horarios',    href: '/profesor/horarios',     icon: <BookOpen className="size-4" /> },
    { key: 'programas',   href: '/profesor/programas',    icon: <ClipboardList className="size-4" /> },
  ],
  alumno: [
    { key: 'mis_clases', href: '/alumno',         icon: <LayoutDashboard className="size-4" /> },
    { key: 'agenda',     href: '/alumno/agenda',  icon: <Calendar className="size-4" /> },
    { key: 'horario',    href: '/alumno/horario', icon: <GraduationCap className="size-4" /> },
    { key: 'perfil',     href: '/alumno/perfil',  icon: <User className="size-4" /> },
  ],
  // Lector: sin items en sidebar — su única sección (recursos) se accede
  // directamente desde /lector. NO agregar 'perfil' aquí; el lector edita
  // su perfil desde el menú de usuario en la Navbar (dropdown → "Editar perfil").
  lector: [],
};

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { user } = useUserStore();
  const tenant = useTenant();
  const t = useTranslations('nav');
  const supabase = createClient();

  const isAdmin = user?.rol === 'admin';
  const isProfesorOrAdmin = user?.rol === 'admin' || user?.rol === 'profesor';

  // Consulta ligera para saber si hay lectores (solo admin, staleTime largo)
  const { data: hasLectores } = useQuery({
    queryKey: ['admin-lectores-exists'],
    enabled: isAdmin,
    staleTime: 5 * 60_000, // 5 min
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('rol', 'lector');
      return (count ?? 0) > 0;
    },
  });

  // Construir items del nav con lectores inyectado condicionalmente para admin
  const baseItems = user ? navItems[user.rol] : [];
  const items: NavItem[] = isAdmin
    ? baseItems.reduce<NavItem[]>((acc, item) => {
        acc.push(item);
        // Después de 'alumnos' y antes de 'programas', insertar 'lectores' si corresponde
        if (item.key === 'alumnos' && hasLectores) {
          acc.push({
            key: 'lectores',
            href: '/admin/lectores',
            icon: <BookMarked className="size-4" />,
          });
        }
        return acc;
      }, [])
    : baseItems;

  // href de recursos compartidos según rol
  const sharedFilesHref =
    user?.rol === 'admin'
      ? '/admin/recursos'
      : user?.rol === 'profesor'
      ? '/profesor/recursos'
      : user?.rol === 'lector'
      ? '/lector/recursos'
      : '/alumno/recursos';

  const enlacesHref = '/enlaces-invitacion';

  const isSharedFilesActive = pathname.startsWith(sharedFilesHref);
  const isEnlacesActive = pathname.startsWith(enlacesHref);

  const navLink = (href: string, active: boolean, icon: React.ReactNode, label: string) => (
    <Link
      href={href}
      onClick={() => setSidebarOpen(false)}
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
      )}
    >
      {icon}
      {label}
    </Link>
  );

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
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
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
            const isActive = item.href === '/admin'
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
                )}
              >
                {item.icon}
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section: enlaces + recursos */}
        <div className="border-t border-[var(--color-border)] p-3 space-y-1">
          {isProfesorOrAdmin && navLink(
            enlacesHref,
            isEnlacesActive,
            <Link2 className="size-4" />,
            t('enlaces_invitacion'),
          )}
          {navLink(
            sharedFilesHref,
            isSharedFilesActive,
            <FolderOpen className="size-4" />,
            t('recursos'),
          )}
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
