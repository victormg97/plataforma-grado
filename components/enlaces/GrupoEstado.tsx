'use client';

import { useTranslations } from 'next-intl';
import { Collapsible } from '@/components/common/Collapsible';
import { FilaEnlace } from './FilaEnlace';
import { etiquetaEstado } from '@/lib/enlaces/agrupar';
import type { EnlaceListItem } from '@/lib/enlaces/types';

interface GrupoEstadoProps {
  estado: string;
  items: EnlaceListItem[];
  rol: string;
  onEditar: (enlace: EnlaceListItem) => void;
  onToggleEstado: (enlace: EnlaceListItem, accion: 'habilitar' | 'deshabilitar') => void;
  onEliminar: (enlace: EnlaceListItem) => void;
}

export function GrupoEstado({
  estado,
  items,
  rol,
  onEditar,
  onToggleEstado,
  onEliminar,
}: GrupoEstadoProps) {
  const t = useTranslations('enlaces');

  // Etiqueta del estado con fallback legible (extensible a estados futuros).
  const titulo = etiquetaEstado(estado, (key) => {
    const traducido = t(`estados.${key}`);
    return traducido;
  });

  return (
    <Collapsible title={titulo} badge={items.length} defaultOpen={false}>
      <div className="space-y-3">
        {items.map((enlace) => (
          <FilaEnlace
            key={enlace.id}
            enlace={enlace}
            rol={rol}
            onEditar={onEditar}
            onToggleEstado={onToggleEstado}
            onEliminar={onEliminar}
          />
        ))}
      </div>
    </Collapsible>
  );
}
