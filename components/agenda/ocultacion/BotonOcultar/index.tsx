'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/common/Button';
import type { TipoEventoAgenda } from '@/lib/agenda/nucleo';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BotonOcultarProps {
  eventoId: string;
  tipo: TipoEventoAgenda;
  oculto: boolean;
  onToggle?: (oculto: boolean) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Botón para ocultar/mostrar una Actividad del calendario del alumno.
 *
 * Solo se muestra cuando `tipo === 'actividad'` (Requisito 9.8).
 * Usa estado optimista: cambia ícono/label al instante y revierte si la API falla.
 */
export function BotonOcultar({
  eventoId,
  tipo,
  oculto,
  onToggle,
}: BotonOcultarProps) {
  const t = useTranslations('agendaOcultacion');
  const queryClient = useQueryClient();

  const [optimista, setOptimista] = useState(oculto);
  const [cargando, setCargando] = useState(false);

  // Requisito 9.8: solo se muestra en Actividades
  if (tipo !== 'actividad') return null;

  const handleToggle = async () => {
    const nuevoEstado = !optimista;

    // Actualización optimista inmediata
    setOptimista(nuevoEstado);
    setCargando(true);

    try {
      const res = nuevoEstado
        ? await fetch('/api/agenda/ocultaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventoId }),
          })
        : await fetch(`/api/agenda/ocultaciones/${eventoId}`, {
            method: 'DELETE',
          });

      if (!res.ok) {
        // Revertir estado optimista
        setOptimista(!nuevoEstado);
        return;
      }

      const { data } = await res.json();

      // Notificar al padre con el resultado de la API
      onToggle?.(data.oculto);

      // Invalidar queries relacionadas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agenda-ocultaciones'] }),
        queryClient.invalidateQueries({ queryKey: ['agenda-eventos'] }),
      ]);
    } catch {
      // Revertir estado optimista en caso de error de red
      setOptimista(!nuevoEstado);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      icon={
        optimista ? (
          <Eye className="size-4" />
        ) : (
          <EyeOff className="size-4" />
        )
      }
      loading={cargando}
      onClick={handleToggle}
    >
      {optimista ? t('mostrar') : t('ocultar')}
    </Button>
  );
}
