'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { AppSwitch } from '@/components/common/AppSwitch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DiscountCode } from '@/lib/referidos/types';

interface ModalCodigoDescuentoProps {
  open: boolean;
  onClose: () => void;
  code?: DiscountCode | null;
}

export function ModalCodigoDescuento({ open, onClose, code }: ModalCodigoDescuentoProps) {
  const t = useTranslations('referidos');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const isEditing = !!code;

  const [codeValue, setCodeValue] = useState(code?.code || '');
  const [autoGenerate, setAutoGenerate] = useState(!isEditing);
  const [startDate, setStartDate] = useState(code?.start_date || '');
  const [endDate, setEndDate] = useState(code?.end_date || '');
  const [manualOverride, setManualOverride] = useState<boolean | null>(code?.manual_override ?? null);
  const [isActive, setIsActive] = useState(code?.is_active ?? true);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: autoGenerate ? undefined : codeValue.trim().toUpperCase(),
        auto_generate: autoGenerate,
        start_date: startDate || null,
        end_date: endDate || null,
        is_active: isActive,
      };

      const res = await fetch('/api/referidos/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Error al crear');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t('exito_codigo_creado'));
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || t('error_codigo')),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        start_date: startDate || null,
        end_date: endDate || null,
        is_active: isActive,
        manual_override: manualOverride,
      };

      const res = await fetch(`/api/referidos/discount-codes/${code!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Error al actualizar');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t('exito_codigo_actualizado'));
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || t('error_codigo')),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('editar_codigo_descuento') : t('crear_codigo_descuento')}
    >
      <div className="space-y-5">
        {/* Code input */}
        {!isEditing && (
          <>
            <AppSwitch
              checked={autoGenerate}
              onChange={setAutoGenerate}
              label={t('auto_generar')}
            />
            {!autoGenerate && (
              <div>
                <Label className="mb-1.5">{t('codigo_6_chars')}</Label>
                <Input
                  value={codeValue}
                  onChange={(e) => setCodeValue(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="PROMO1"
                  maxLength={6}
                  className="font-mono tracking-wider uppercase"
                />
              </div>
            )}
          </>
        )}

        {isEditing && (
          <div>
            <Label className="mb-1.5">{t('columna_codigo')}</Label>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2.5 font-mono font-bold tracking-wider text-[var(--color-brand-gold)]">
              {code.code}
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5">{t('fecha_inicio')}</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5">{t('fecha_termino')}</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Manual override */}
        {isEditing && (
          <AppSwitch
            checked={manualOverride !== null}
            onChange={(v) => setManualOverride(v ? isActive : null)}
            label={t('override_manual')}
            description={t('override_manual_desc')}
          />
        )}

        {/* Active */}
        <AppSwitch
          checked={isActive}
          onChange={setIsActive}
          label={t('estado_activo')}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {tc('cancelar')}
          </Button>
          <Button
            onClick={() => isEditing ? updateMutation.mutate() : createMutation.mutate()}
            loading={isPending}
            disabled={!isEditing && !autoGenerate && codeValue.length !== 6}
          >
            {isEditing ? tc('guardar') : t('crear_codigo_descuento')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
