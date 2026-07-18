'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Mail, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { Tooltip } from '@/components/common/Tooltip';

interface ReminderButtonProps {
  horarioId: string;
}

interface RecordatorioStatus {
  total_enviados: number;
  puede_enviar: boolean;
  minutos_restantes: number;
  cooldown_minutos: number;
  clase_pasada: boolean;
}

export function ReminderButton({ horarioId }: ReminderButtonProps) {
  const t = useTranslations('horarios.recordatorio');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: status } = useQuery<RecordatorioStatus>({
    queryKey: ['recordatorio-status', horarioId],
    queryFn: async () => {
      const res = await fetch(`/api/horarios/${horarioId}/recordatorio`);
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch(`/api/horarios/${horarioId}/recordatorio`, {
        method: 'POST',
      });

      if (res.status === 429) {
        const body = await res.json();
        toast.error(t('cooldown_error', { minutos: body.minutos_restantes }));
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.error === 'clase_pasada') {
          toast.error(t('clase_pasada'));
        } else {
          throw new Error(body?.error || 'Error al enviar');
        }
        return;
      }

      const data = await res.json();
      if (data.resultado === 'enviado') {
        toast.success(t('enviado'));
      } else {
        toast.warning(t('no_enviado'));
      }

      queryClient.invalidateQueries({ queryKey: ['recordatorio-status', horarioId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  }

  const totalEnviados = status?.total_enviados ?? 0;
  const puedeEnviar = status?.puede_enviar ?? true;
  const minutosRestantes = status?.minutos_restantes ?? 0;
  const clasePasada = status?.clase_pasada ?? false;

  const disabled = sending || !puedeEnviar || clasePasada;

  // Build confirm description
  const confirmDescription = totalEnviados > 0
    ? t('confirmar_desc_con_envios', { count: totalEnviados })
    : t('confirmar_desc');

  const button = (
    <button
      type="button"
      onClick={() => {
        if (!disabled) setShowConfirm(true);
      }}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 rounded-[var(--radius-sm)] border px-3.5 py-2 text-sm font-medium transition-colors',
        !disabled
          ? 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold)] hover:bg-[color-mix(in_srgb,var(--color-brand-gold)_8%,transparent)]'
          : 'border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed opacity-60',
      )}
    >
      {sending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Mail className="size-4" />
      )}
      {t('boton')}
      {totalEnviados > 0 && (
        <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_15%,transparent)] text-xs font-bold text-[var(--color-brand-gold)]">
          {totalEnviados}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {clasePasada ? (
        <Tooltip content={t('clase_pasada')}>
          {button}
        </Tooltip>
      ) : (
        button
      )}

      {!clasePasada && !puedeEnviar && minutosRestantes > 0 && (
        <span className="text-xs text-[var(--color-text-muted)]">
          {t('cooldown_hint', { minutos: minutosRestantes })}
        </span>
      )}

      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSend}
        title={t('confirmar_titulo')}
        description={confirmDescription}
        confirmText={t('confirmar_enviar')}
        cancelText={tc('cancelar')}
        loading={sending}
        isDanger={false}
      />
    </div>
  );
}
