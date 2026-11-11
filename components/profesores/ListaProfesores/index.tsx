'use client';

/** Sections "Administradores" and "Profesores" of the admin page, with a responsive card grid. */

import { useTranslations } from 'next-intl';
import { ProfesorCard, type ProfesorCardData } from '../ProfesorCard';

interface ListaProfesoresProps {
  profesores: ProfesorCardData[];
  etiquetaCedulario: (id: string) => string;
  onEditar: (profesor: ProfesorCardData) => void;
  onToggleActivo: (profesor: ProfesorCardData) => void;
  onCedulario: (profesor: ProfesorCardData) => void;
}

interface SeccionProps extends Omit<ListaProfesoresProps, 'profesores'> {
  titulo: string;
  items: ProfesorCardData[];
}

function Seccion({ titulo, items, etiquetaCedulario, onEditar, onToggleActivo, onCedulario }: SeccionProps) {
  if (items.length === 0) return null;
  return (
    <section aria-label={titulo} className="space-y-[var(--space-md)]">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{titulo}</h2>
        <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent-fg)]">
          {items.length}
        </span>
        <div aria-hidden="true" className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
      <div className="grid grid-cols-1 gap-[var(--space-md)] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {items.map((p, indice) => (
          <ProfesorCard
            key={p.id}
            profesor={p}
            indice={indice}
            etiquetaCedulario={etiquetaCedulario(p.id)}
            onEditar={() => onEditar(p)}
            onToggleActivo={() => onToggleActivo(p)}
            onCedulario={() => onCedulario(p)}
          />
        ))}
      </div>
    </section>
  );
}

export function ListaProfesores({ profesores, ...acciones }: ListaProfesoresProps) {
  const tp = useTranslations('profesores');
  const admins = profesores.filter((p) => p.rol === 'admin');
  const docentes = profesores.filter((p) => p.rol !== 'admin');

  return (
    <div className="space-y-[var(--space-xl,2rem)]">
      <Seccion titulo={tp('seccion_admins')} items={admins} {...acciones} />
      <Seccion titulo={tp('seccion_profesores')} items={docentes} {...acciones} />
    </div>
  );
}
