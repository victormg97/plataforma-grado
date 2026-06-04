'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AppSelect } from '@/components/common/AppSelect';
import { opcionesDistintas, filtroDeshabilitado, type FiltroState } from '@/lib/enlaces/filtrar';
import type { EnlaceListItem } from '@/lib/enlaces/types';

interface FiltrosEnlacesProps {
  enlaces: EnlaceListItem[];
  filtro: FiltroState;
  onChange: (f: FiltroState) => void;
}

const TODOS = '__todos__';

export function FiltrosEnlaces({ enlaces, filtro, onChange }: FiltrosEnlacesProps) {
  const t = useTranslations('enlaces');

  // Mapa id->nombre para el filtro de creador, derivado de los datos visibles.
  const creadores = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of enlaces) {
      if (e.created_by && !map.has(e.created_by)) {
        map.set(e.created_by, e.creador ? `${e.creador.nombre} ${e.creador.apellido}`.trim() : t('creador_desconocido'));
      }
    }
    return map;
  }, [enlaces, t]);

  const tiposDistintos = useMemo(() => opcionesDistintas(enlaces, 'tipo'), [enlaces]);
  const creadoresDistintos = useMemo(() => Array.from(creadores.keys()), [creadores]);

  const creadorDisabled = filtroDeshabilitado(creadoresDistintos, filtro.creador);
  const tipoDisabled = filtroDeshabilitado(tiposDistintos, filtro.tipo);

  const creadorOptions = [
    { value: TODOS, label: t('filtro_todos') },
    ...creadoresDistintos.map((id) => ({ value: id, label: creadores.get(id) ?? id })),
  ];

  const tipoOptions = [
    { value: TODOS, label: t('filtro_todos') },
    ...tiposDistintos.map((tp) => ({
      value: tp,
      label:
        tp === 'profesor'
          ? t('tipos.profesor')
          : tp === 'lector'
          ? t('tipos.lector')
          : t('tipos.alumno'),
    })),
  ];

  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">{t('filtro_creador')}</span>
        <AppSelect
          value={filtro.creador ?? TODOS}
          onChange={(v) => onChange({ ...filtro, creador: v === TODOS ? null : v })}
          options={creadorOptions}
          disabled={creadorDisabled}
          className="min-w-[180px]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">{t('filtro_tipo')}</span>
        <AppSelect
          value={filtro.tipo ?? TODOS}
          onChange={(v) => onChange({ ...filtro, tipo: v === TODOS ? null : v })}
          options={tipoOptions}
          disabled={tipoDisabled}
          className="min-w-[150px]"
        />
      </div>
    </div>
  );
}
