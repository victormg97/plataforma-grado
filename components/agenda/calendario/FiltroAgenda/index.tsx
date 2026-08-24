'use client';

/**
 * Componente de filtro del calendario de la agenda (Requisitos 12.3, 12.4).
 *
 * Botón compacto con Popover que contiene tres switches para controlar la
 * visibilidad de Clases, Entradas Personales y Actividades en la vista de
 * calendario. El estado vive en el query param `agenda` y no modifica datos
 * persistidos.
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Filter } from 'lucide-react';
import { useFiltroAgenda } from '@/lib/agenda/calendario';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function FiltroAgenda() {
  const t = useTranslations('agendaCalendario');
  const [filtro, setFiltro] = useFiltroAgenda();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Count inactive filters for badge
  const totalFilters = 3;
  const activeCount = [filtro.clases, filtro.entradasPersonales, filtro.actividades].filter(Boolean).length;
  const inactiveCount = totalFilters - activeCount;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('filtro_btn_aria')}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]"
      >
        <Filter className="size-3.5" />
        <span className="hidden sm:inline">{t('filtro_btn')}</span>
        {inactiveCount > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-[var(--color-brand-gold)] text-[10px] font-bold leading-none text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* Popover panel */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 shadow-lg">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="filtro-clases" className="text-sm">
                {t('filtro_clases')}
              </Label>
              <Switch
                checked={filtro.clases}
                onCheckedChange={(checked) =>
                  setFiltro({ ...filtro, clases: checked })
                }
                id="filtro-clases"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="filtro-entradas" className="text-sm">
                {t('filtro_entradas')}
              </Label>
              <Switch
                checked={filtro.entradasPersonales}
                onCheckedChange={(checked) =>
                  setFiltro({ ...filtro, entradasPersonales: checked })
                }
                id="filtro-entradas"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="filtro-actividades" className="text-sm">
                {t('filtro_actividades')}
              </Label>
              <Switch
                checked={filtro.actividades}
                onCheckedChange={(checked) =>
                  setFiltro({ ...filtro, actividades: checked })
                }
                id="filtro-actividades"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
