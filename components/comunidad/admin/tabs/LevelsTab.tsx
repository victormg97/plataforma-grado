'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { useAdminLevels, useUpdateLevels } from '@/lib/hooks/useComunidadAdmin';
import type { GameLevelThreshold } from '@/lib/supabase/types';
import { ConfigCallout, ConfigSection } from '../ui';

interface LevelRow {
  level: number;
  min_points: number;
  label: string;
}

/** Levels tab: edit the tenant's configurable level thresholds (XP-based). */
export function LevelsTab() {
  const t = useTranslations('comunidadEstrategica');
  const { data, isLoading, isError, refetch } = useAdminLevels();

  if (isError) {
    return (
      <Card padding="lg" className="flex flex-col items-center gap-3 text-center" role="alert">
        <p className="text-sm text-[var(--color-error)]">{t('error_loading')}</p>
        <Button variant="secondary" onClick={() => refetch()}>{t('error_retry')}</Button>
      </Card>
    );
  }
  if (isLoading || !data) {
    return <Card padding="lg" role="status" aria-live="polite">{t('admin_loading')}</Card>;
  }

  return <LevelsForm key={data.map((l) => l.id).join(',') || 'empty'} initial={data} />;
}

function LevelsForm({ initial }: { initial: GameLevelThreshold[] }) {
  const t = useTranslations('comunidadEstrategica');
  const update = useUpdateLevels();

  const [rows, setRows] = useState<LevelRow[]>(
    initial.length > 0
      ? initial.map((l) => ({ level: l.level, min_points: l.min_points, label: l.label ?? '' }))
      : [{ level: 1, min_points: 0, label: '' }]
  );

  const setRow = (i: number, patch: Partial<LevelRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => {
    const nextLevel = rows.reduce((m, r) => Math.max(m, r.level), 0) + 1;
    const lastPts = rows.reduce((m, r) => Math.max(m, r.min_points), 0);
    setRows((rs) => [...rs, { level: nextLevel, min_points: lastPts + 100, label: '' }]);
  };

  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const onSave = async () => {
    try {
      await update.mutateAsync({
        levels: rows.map((r) => ({
          level: r.level,
          min_points: r.min_points,
          label: r.label.trim() || null,
        })),
      });
      toast.success(t('admin_saved'));
    } catch (e) {
      const code = (e as { message?: string })?.message;
      if (code === 'RANGO_INVALIDO') toast.error(t('levels_error_range'));
      else toast.error(t('admin_error'));
    }
  };

  const sorted = rows.slice().sort((a, b) => a.level - b.level);

  return (
    <div className="flex flex-col gap-5">
      <ConfigCallout title={t('levels_intro_title')}>{t('levels_intro_desc')}</ConfigCallout>

      <ConfigSection
        icon={<TrendingUp className="size-4" />}
        title={t('levels_section_title')}
        description={t('levels_hint')}
      >
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[70px_1fr_1.3fr_40px] items-center gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            <span>{t('levels_col_level')}</span>
            <span>{t('levels_col_min_points')}</span>
            <span>{t('levels_col_label')}</span>
            <span />
          </div>

          {sorted.map((r) => {
            const i = rows.indexOf(r);
            const isBase = r.level === 1;
            return (
              <div key={r.level} className="grid grid-cols-[70px_1fr_1.3fr_40px] items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)] text-xs font-bold text-[var(--color-brand-gold)]">
                    {r.level}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={r.min_points}
                  disabled={isBase}
                  title={isBase ? t('levels_level1_locked') : undefined}
                  onChange={(e) => setRow(i, { min_points: Number(e.target.value) })}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none disabled:opacity-60"
                />
                <input
                  type="text"
                  value={r.label}
                  placeholder={t('levels_label_placeholder')}
                  onChange={(e) => setRow(i, { label: e.target.value })}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={isBase}
                  aria-label={t('admin_remove')}
                  title={isBase ? t('levels_level1_locked') : t('admin_remove')}
                  className="flex items-center justify-center rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)] disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}

          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('levels_level1_locked')}</p>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="secondary" icon={<Plus className="size-4" />} onClick={addRow}>
            {t('levels_add')}
          </Button>
          <Button onClick={onSave} loading={update.isPending}>
            {t('admin_save')}
          </Button>
        </div>
      </ConfigSection>
    </div>
  );
}
