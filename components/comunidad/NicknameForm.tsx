'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
  nicknameSchema,
} from '@/lib/comunidad/nickname';
import { useUpdateNickname, type NicknameError } from '@/lib/hooks/useComunidad';

/**
 * Reusable nickname form used both in onboarding and in the profile view.
 * Validates locally with the shared schema and surfaces server error codes
 * (taken / cooldown / format) as localized messages.
 */
export function NicknameForm({
  initialValue = '',
  submitLabel,
  onSaved,
}: {
  initialValue?: string;
  submitLabel?: string;
  onSaved?: (nickname: string) => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const [value, setValue] = useState(initialValue);
  const [localError, setLocalError] = useState<string | null>(null);
  const mutation = useUpdateNickname();

  const serverError = mutation.error as NicknameError | null;

  const errorMessage = (() => {
    if (localError) return localError;
    if (!serverError) return null;
    switch (serverError.error) {
      case 'NICKNAME_TAKEN':
        return t('nickname_error_taken');
      case 'COOLDOWN_ACTIVE':
        return t('nickname_error_cooldown', { days: serverError.days_remaining ?? 1 });
      case 'INVALID_FORMAT':
      default:
        return t('nickname_error_format', {
          min: NICKNAME_MIN_LENGTH,
          max: NICKNAME_MAX_LENGTH,
        });
    }
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const parsed = nicknameSchema.safeParse(value);
    if (!parsed.success) {
      setLocalError(
        t('nickname_error_format', { min: NICKNAME_MIN_LENGTH, max: NICKNAME_MAX_LENGTH })
      );
      return;
    }
    mutation.mutate(parsed.data, {
      onSuccess: (res) => onSaved?.(res.nickname),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setLocalError(null);
          mutation.reset();
        }}
        placeholder={t('nickname_placeholder')}
        maxLength={NICKNAME_MAX_LENGTH}
        aria-label={t('nickname_label')}
        className="h-11 rounded-[var(--game-radius)] border border-[var(--game-border)] bg-[var(--game-bg)] px-4 text-sm text-[var(--game-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-accent)]"
      />
      <p className="text-xs text-[var(--game-text-muted)]">
        {t('nickname_hint', { min: NICKNAME_MIN_LENGTH, max: NICKNAME_MAX_LENGTH })}
      </p>
      {errorMessage && <p className="text-sm text-[var(--game-incorrect)]">{errorMessage}</p>}
      <button
        type="submit"
        disabled={value.trim().length === 0 || mutation.isPending}
        className="inline-flex items-center justify-center rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-5 py-3 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)] disabled:pointer-events-none disabled:opacity-50"
      >
        {mutation.isPending ? '…' : submitLabel ?? t('nickname_submit')}
      </button>
    </form>
  );
}
