'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Share2 } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Tooltip } from '@/components/common/Tooltip';

interface MiCodigoCardProps {
  code: string;
  displayName: string;
  disabled: boolean;
  disabledReason?: string;
}

export function MiCodigoCard({ code, displayName, disabled, disabledReason }: MiCodigoCardProps) {
  const t = useTranslations('referidos');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: displayName,
          text: code,
        });
      } catch {
        // Fallback to copy if share was cancelled or failed
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const content = (
    <div className="flex gap-2 justify-center mt-[var(--space-md)]">
      <Button
        variant="secondary"
        onClick={handleCopy}
        disabled={disabled}
        icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      >
        {copied ? t('copiado') : t('copiar')}
      </Button>
      <Button
        variant="primary"
        onClick={handleShare}
        disabled={disabled}
        icon={<Share2 className="size-4" />}
      >
        {t('compartir')}
      </Button>
    </div>
  );

  return (
    <Card className="text-center p-[var(--space-xl)] bg-[var(--color-bg-secondary)]">
      <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
        {t('mi_codigo')}
      </h3>
      <div className="bg-[var(--color-bg)] rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 my-[var(--space-md)] inline-block min-w-[200px]">
        <span className="font-mono text-2xl font-bold tracking-widest text-[var(--color-brand-gold)]">
          {code}
        </span>
      </div>
      
      {disabled && disabledReason ? (
        <Tooltip content={disabledReason}>
          <div className="inline-block">{content}</div>
        </Tooltip>
      ) : (
        content
      )}
    </Card>
  );
}
