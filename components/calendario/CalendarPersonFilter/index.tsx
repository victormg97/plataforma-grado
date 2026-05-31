'use client';

import { useMemo } from 'react';
import { Users, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AppSelect } from '@/components/common/AppSelect';

export const ALL_PEOPLE = 'all';

export interface CalendarPerson {
  id: string;
  nombre: string;
  apellido: string;
  apellido_materno?: string | null;
  rol?: string;
}

interface CalendarPersonFilterProps {
  /** Profesores/admins to choose from. */
  people: CalendarPerson[];
  /** Selected person id, or ALL_PEOPLE to show everyone. */
  value: string;
  onChange: (value: string) => void;
  /** Current user's id — sorted to top and marked with "(tú)". */
  currentUserId?: string;
  className?: string;
  id?: string;
}

/**
 * Reusable person selector for calendar views. Lets the viewer choose whose
 * schedule to display (everyone, themselves, or a specific person).
 *
 * Currently used by the admin calendar; designed to be drop-in for the
 * professor calendar in the future by passing a different `people` list.
 */
export function CalendarPersonFilter({
  people,
  value,
  onChange,
  currentUserId,
  className,
  id,
}: CalendarPersonFilterProps) {
  const t = useTranslations('horarios');

  const options = useMemo(() => {
    const fullName = (p: CalendarPerson) =>
      [p.nombre, p.apellido, p.apellido_materno].filter(Boolean).join(' ');

    const sorted = [...people].sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return fullName(a).localeCompare(fullName(b));
    });

    return [
      { value: ALL_PEOPLE, label: t('filtro_calendario_todos'), icon: <Users className="size-4" /> },
      ...sorted.map((p) => ({
        value: p.id,
        label: p.id === currentUserId ? `${fullName(p)} ${t('filtro_calendario_yo')}` : fullName(p),
        icon: <User className="size-4" />,
      })),
    ];
  }, [people, currentUserId, t]);

  return (
    <AppSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      className={className}
    />
  );
}
