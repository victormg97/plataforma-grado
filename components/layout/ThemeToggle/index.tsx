'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, GraduationCap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUserStore } from '@/stores/useUserStore';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const esGraduado = useUserStore((s) => s.esGraduado);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="size-9" />;
  }

  function cycleTheme() {
    if (esGraduado) {
      if (theme === 'light') setTheme('dark');
      else if (theme === 'dark') setTheme('graduado');
      else setTheme('light');
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  }

  function getIcon() {
    if (theme === 'dark') return <Moon className="size-4" />;
    if (theme === 'graduado') return <GraduationCap className="size-4 text-[#C9993F]" />;
    return <Sun className="size-4" />;
  }

  function getLabel() {
    if (theme === 'dark') return 'Tema oscuro — cambiar a claro';
    if (theme === 'graduado') return 'Tema graduado — cambiar a claro';
    return esGraduado ? 'Tema claro — cambiar a oscuro' : 'Toggle theme';
  }

  return (
    <button
      onClick={cycleTheme}
      className="inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
      aria-label={getLabel()}
    >
      {getIcon()}
    </button>
  );
}
