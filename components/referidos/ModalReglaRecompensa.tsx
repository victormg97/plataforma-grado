'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { AppSwitch } from '@/components/common/AppSwitch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ReferralRewardRule } from '@/lib/referidos/types';

interface ModalReglaRecompensaProps {
  open: boolean;
  onClose: () => void;
  rule?: ReferralRewardRule | null;
}

const RULE_TYPES = [
  { value: 'referred_new', label: 'regla_referido_nuevo' },
  { value: 'referrer', label: 'regla_referente' },
  { value: 'volume_goal', label: 'regla_meta_volumen' },
];

const REWARD_TYPES = [
  { value: 'fixed_amount', label: 'tipo_monto_fijo' },
  { value: 'percentage', label: 'tipo_porcentaje' },
  { value: 'free_session', label: 'tipo_sesion_gratis' },
  { value: 'custom', label: 'tipo_personalizado' },
];

const PERIODS = [
  { value: 'weekly', label: 'periodo_semanal' },
  { value: 'monthly', label: 'periodo_mensual' },
  { value: 'quarterly', label: 'periodo_trimestral' },
];

export function ModalReglaRecompensa({ open, onClose, rule }: ModalReglaRecompensaProps) {
  const t = useTranslations('referidos');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const isEditing = !!rule;

  const [ruleType, setRuleType] = useState(rule?.rule_type || 'referrer');
  const [rewardType, setRewardType] = useState(rule?.reward_type || 'fixed_amount');
  const [rewardValue, setRewardValue] = useState(String(rule?.reward_value ?? 5000));
  const [durationCycles, setDurationCycles] = useState(String(rule?.duration_cycles ?? 1));
  const [packSize, setPackSize] = useState(String(rule?.pack_size ?? 1));
  const [maxDiscount, setMaxDiscount] = useState(String(rule?.max_discount_per_cycle ?? 0));
  const [volumeTarget, setVolumeTarget] = useState(String(rule?.volume_target ?? 5));
  const [volumePeriod, setVolumePeriod] = useState(rule?.volume_period || 'monthly');
  const [volumeDesc, setVolumeDesc] = useState(rule?.volume_reward_description || '');
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        rule_type: ruleType,
        reward_type: rewardType,
        reward_value: parseFloat(rewardValue) || 0,
        duration_cycles: parseInt(durationCycles) || 1,
        pack_size: parseInt(packSize) || 1,
        max_discount_per_cycle: parseFloat(maxDiscount) || 0,
        volume_target: ruleType === 'volume_goal' ? (parseInt(volumeTarget) || null) : null,
        volume_period: ruleType === 'volume_goal' ? volumePeriod : null,
        volume_reward_description: ruleType === 'volume_goal' ? (volumeDesc || null) : null,
        is_active: isActive,
      };

      const url = isEditing
        ? `/api/referidos/reward-rules/${rule.id}`
        : '/api/referidos/reward-rules';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Error al guardar');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t('exito_regla_guardada'));
      queryClient.invalidateQueries({ queryKey: ['referral-reward-rules'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || t('error_regla')),
  });

  const isVolumeGoal = ruleType === 'volume_goal';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('editar_regla') : t('nueva_regla')}
    >
      <div className="space-y-5">
        {/* Rule type */}
        <div>
          <Label className="mb-1.5">{t('regla_tipo')}</Label>
          <AppSelect
            value={ruleType}
            options={RULE_TYPES.map((r) => ({ value: r.value, label: t(r.label) }))}
            onChange={(v) => setRuleType(v as typeof ruleType)}
          />
        </div>

        {/* Reward type */}
        <div>
          <Label className="mb-1.5">{t('regla_recompensa')}</Label>
          <AppSelect
            value={rewardType}
            options={REWARD_TYPES.map((r) => ({ value: r.value, label: t(r.label) }))}
            onChange={(v) => setRewardType(v as typeof rewardType)}
          />
        </div>

        {/* Value */}
        {(rewardType === 'fixed_amount' || rewardType === 'percentage') && (
          <div>
            <Label className="mb-1.5">
              {t('valor')} {rewardType === 'percentage' ? '(%)' : '($)'}
            </Label>
            <Input
              type="number"
              min="0"
              step={rewardType === 'percentage' ? '1' : '100'}
              value={rewardValue}
              onChange={(e) => setRewardValue(e.target.value)}
            />
          </div>
        )}

        {/* Duration */}
        {!isVolumeGoal && (rewardType === 'fixed_amount' || rewardType === 'percentage') && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5">{t('duracion_ciclos')}</Label>
              <Input
                type="number"
                min="1"
                value={durationCycles}
                onChange={(e) => setDurationCycles(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5">{t('tamano_pack')}</Label>
              <Input
                type="number"
                min="1"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Max discount cap */}
        {!isVolumeGoal && (rewardType === 'fixed_amount' || rewardType === 'percentage') && (
          <div>
            <Label className="mb-1.5">{t('tope_descuento')}</Label>
            <Input
              type="number"
              min="0"
              step="1000"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="0 = sin tope"
            />
          </div>
        )}

        {/* Volume goal fields */}
        {isVolumeGoal && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5">{t('referidos_objetivo')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={volumeTarget}
                  onChange={(e) => setVolumeTarget(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5">{t('periodo')}</Label>
                <AppSelect
                  value={volumePeriod}
                  options={PERIODS.map((p) => ({ value: p.value, label: t(p.label) }))}
                  onChange={(v) => setVolumePeriod(v as typeof volumePeriod)}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5">{t('descripcion_recompensa_meta')}</Label>
              <Input
                value={volumeDesc}
                onChange={(e) => setVolumeDesc(e.target.value)}
                placeholder={t('descripcion_recompensa_meta_placeholder')}
              />
            </div>
          </>
        )}

        {/* Active toggle */}
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
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
          >
            {t('guardar_regla')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
