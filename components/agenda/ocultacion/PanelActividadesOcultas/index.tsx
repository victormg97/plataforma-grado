'use client';

/**
 * Panel lateral que muestra las Actividades ocultas por el alumno en el
 * Rango_Visible actual (Requisitos 9.3, 9.7, 9.10, 9.11, 9.12).
 *
 * Estado abierto/cerrado controlado por el query param `ocultas`.
 * Cada item ofrece un botón para restaurar (DELETE /api/agenda/ocultaciones/:eventoId).
 */

import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { EyeOff, Eye } from 'lucide-react';

import { useQueryParam } from '@/lib/hooks/useQueryParam';
import { useActividadesOcultas } from '@/lib/agenda/ocultacion';
import type { RangoVisible } from '@/lib/agenda/nucleo';
import { Button } from '@/components/common/Button';

interface PanelActividadesOcultasProps {
  rango: RangoVisible;
  usuarioId: string | undefined;
}

export function PanelActividadesOcultas({
  rango,
  usuarioId,
}: PanelActividadesOcultasProps) {
  const t = useTranslations('agendaOcultacion');
  const queryClient = useQueryClient();
  const [panelAbierto, setPanelAbierto] = useQueryParam('ocultas');
  const { ocultas } = useActividadesOcultas({ usuarioId, rango });

  const isOpen = panelAbierto === '1';

  async function handleRestaurar(eventoId: string) {
    const res = await fetch(`/api/agenda/ocultaciones/${eventoId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ['agenda-ocultaciones'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-eventos'] });
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setPanelAbierto(isOpen ? null : '1')}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <EyeOff className="size-4" />
        <span>
          {t('panel_titulo')} ({ocultas.length})
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
          {ocultas.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t('panel_vacio')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ocultas.map((actividad) => (
                <li
                  key={actividad.eventoId}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {actividad.titulo}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {actividad.fecha} · {actividad.hora_inicio.slice(0, 5)} – {actividad.hora_fin.slice(0, 5)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestaurar(actividad.eventoId)}
                    className="shrink-0"
                  >
                    <Eye className="mr-1 size-3.5" />
                    {t('btn_restaurar')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
