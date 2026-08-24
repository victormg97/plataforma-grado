'use client';

/**
 * Leyenda del calendario de la agenda (Requisito 12.4).
 *
 * Muestra una entrada por tipo y por categoría presente en el Rango_Visible,
 * usando el mismo color que el calendario utiliza para renderizar cada tipo/categoría.
 * Si no hay entradas, no se renderiza nada.
 */

import { useTranslations } from 'next-intl';
import { construirLeyenda } from '@/lib/agenda/calendario';
import type { EventoAgendaProyectado } from '@/lib/agenda/nucleo';

interface LeyendaAgendaProps {
  eventos: EventoAgendaProyectado[];
}

export function LeyendaAgenda({ eventos }: LeyendaAgendaProps) {
  const tCal = useTranslations('agendaCalendario');
  const tCat = useTranslations('agendaNucleo.categorias');

  const entradas = construirLeyenda(
    eventos,
    (key) => tCat(key),
    (key) => tCal(`tipo_${key}`),
  );

  if (entradas.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">
        {tCal('leyenda_titulo')}
      </span>
      <div className="flex flex-wrap gap-3">
        {entradas.map((entrada) => (
          <div key={entrada.key} className="flex items-center gap-1.5">
            <span
              className="inline-block size-3 rounded-full"
              style={{ backgroundColor: entrada.color }}
            />
            <span className="text-xs text-muted-foreground">
              {entrada.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
