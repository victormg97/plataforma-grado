'use client';

/**
 * Componente de aviso de solapamiento para formularios de agenda.
 *
 * Dos modos:
 * - `bloqueante`: borde error, icono AlertCircle, guardado deshabilitado por el formulario padre.
 * - `advertencia`: borde warning, icono AlertTriangle, guardado permitido.
 *
 * El componente NO llama a `useConflictoLocal` internamente: recibe los conflictos
 * ya calculados como prop. El formulario que lo compone típicamente usa
 * `useConflictoLocal` de `@/lib/agenda/solapamiento` y pasa sus `conflictos` aquí,
 * decidiendo el modo según el rol del usuario.
 *
 * Requisitos: 6.10, 7.6, 15.1, 15.2, 15.5, 15.6, 15.8, 17.10
 */
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { AdvertenciaSolapamiento } from '@/lib/agenda/nucleo';

export interface AvisoSolapamientoProps {
  conflictos: AdvertenciaSolapamiento[];
  modo: 'bloqueante' | 'advertencia';
}

export function AvisoSolapamiento({ conflictos, modo }: AvisoSolapamientoProps) {
  const t = useTranslations('agendaSolapamiento');

  if (conflictos.length === 0) return null;

  const esBloqueante = modo === 'bloqueante';
  const colorVar = esBloqueante ? 'var(--color-error)' : 'var(--color-warning)';
  const Icon = esBloqueante ? AlertCircle : AlertTriangle;
  const claveItem = esBloqueante ? 'bloqueante_item' : 'advertencia_item';

  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border p-3"
      style={{
        borderColor: colorVar,
        backgroundColor: `color-mix(in srgb, ${colorVar} 8%, transparent)`,
      }}
    >
      <div className="flex items-start gap-2">
        <Icon className="size-4 mt-0.5 shrink-0" style={{ color: colorVar }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: colorVar }}>
            {esBloqueante
              ? t('bloqueante_titulo')
              : t('advertencia_titulo', { cantidad: conflictos.length })}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {conflictos.map((c) => (
              <li
                key={c.id}
                className="text-xs text-[var(--color-text-secondary)]"
              >
                {t(claveItem, {
                  titulo: c.titulo,
                  fecha: c.fecha,
                  horaInicio: c.hora_inicio,
                  horaFin: c.hora_fin,
                })}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
