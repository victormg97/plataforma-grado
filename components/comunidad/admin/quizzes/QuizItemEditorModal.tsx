'use client';

/* eslint-disable @next/next/no-img-element -- small public storage previews */
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, ImageUp, LayoutGrid, RotateCcw, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { AppSwitch } from '@/components/common/AppSwitch';
import { GameThemeScope } from '@/components/comunidad/GameThemeScope';
import {
  discardQuizIcon,
  useSaveQuizItem,
  useUploadQuizIcon,
} from '@/lib/hooks/useComunidadAdmin';
import {
  QUIZ_COLOR_KEYS,
  QUIZ_ICON_IMAGE_EXT,
  QUIZ_ICON_KEYS,
  isQuizColorKey,
  isQuizIconKey,
  type QuizDisplaySettings,
  type QuizItemPatch,
} from '@/lib/comunidad/quiz-display';
import { QUIZ_ICONS, quizIconUrl } from '@/components/comunidad/quiz/QuizItemIcon';
import { CategoryTile, SubjectTile } from '@/components/comunidad/quiz/QuizTiles';

export interface QuizEditorTarget {
  kind: 'subject' | 'category';
  subjectId: string;
  categoryId: string | null;
  name: string;
  questionCount: number;
  categoryCount?: number;
  /** Subject color, used as the category's default in the preview. */
  subjectColorKey?: string | null;
  settings: QuizDisplaySettings & { quiz_question_count?: number | null };
}

type IconMode = 'gallery' | 'image';

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none';

/**
 * Editor for one subject or category: icon (gallery or custom image), color,
 * short description, visibility and (subjects) questions per quiz. Shows a
 * live preview with the same tile the players see. Remounted per target.
 */
export function QuizItemEditorModal({
  target,
  onClose,
}: {
  target: QuizEditorTarget;
  onClose: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const save = useSaveQuizItem();
  const upload = useUploadQuizIcon();
  const fileRef = useRef<HTMLInputElement>(null);

  const s = target.settings;
  const isSubject = target.kind === 'subject';
  const defaultIcon = isSubject ? 'book-open' : 'layers';

  const [mode, setMode] = useState<IconMode>(s.icon_image_path ? 'image' : 'gallery');
  const [iconKey, setIconKey] = useState<string | null>(isQuizIconKey(s.icon_key) ? s.icon_key : null);
  const [imagePath, setImagePath] = useState<string | null>(s.icon_image_path);
  const [colorKey, setColorKey] = useState<string | null>(isQuizColorKey(s.color_key) ? s.color_key : null);
  const [description, setDescription] = useState(s.description ?? '');
  const [visible, setVisible] = useState(!s.is_hidden);
  const [count, setCount] = useState(s.quiz_question_count ? String(s.quiz_question_count) : '');
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Images uploaded in this session (discarded if not kept on save).
  const uploadedRef = useRef<string[]>([]);

  const effectiveImage = mode === 'image' ? imagePath : null;
  const effectiveIcon = mode === 'gallery' ? iconKey : null;

  const discardUnused = (keep: string | null) => {
    for (const p of uploadedRef.current) if (p !== keep) discardQuizIcon(p);
    uploadedRef.current = [];
  };

  const close = () => {
    discardUnused(null);
    onClose();
  };

  const onFile = async (file: File) => {
    setUploadError(null);
    try {
      const res = await upload.mutateAsync(file);
      uploadedRef.current.push(res.image_path);
      setImagePath(res.image_path);
      setMode('image');
    } catch (e) {
      const code = (e as { message?: string })?.message;
      setUploadError(
        code === 'INVALID_FORMAT'
          ? t('quizcfg_image_error_format')
          : code === 'TOO_LARGE'
            ? t('quizcfg_image_error_size')
            : t('admin_error')
      );
    }
  };

  const countNumber = count.trim() === '' ? null : Number(count);
  const countInvalid = countNumber !== null && (!Number.isInteger(countNumber) || countNumber < 1 || countNumber > 100);

  const onSave = async () => {
    if (countInvalid) return;
    const patch: QuizItemPatch = {
      icon_key: (effectiveIcon as QuizItemPatch['icon_key']) ?? null,
      icon_image_path: effectiveImage,
      color_key: (colorKey as QuizItemPatch['color_key']) ?? null,
      description: description.trim() || null,
      is_hidden: !visible,
      ...(isSubject ? { quiz_question_count: countNumber } : {}),
    };
    try {
      await save.mutateAsync({ subject_id: target.subjectId, category_id: target.categoryId, patch });
      discardUnused(effectiveImage);
      toast.success(t('admin_saved'));
      onClose();
    } catch {
      toast.error(t('admin_error'));
    }
  };

  const resetDefaults = () => {
    setMode('gallery');
    setIconKey(null);
    setColorKey(null);
  };

  const previewItem = {
    name: target.name,
    description: description.trim() || null,
    iconKey: effectiveIcon,
    imagePath: effectiveImage,
    colorKey,
  };
  const imageUrl = quizIconUrl(imagePath);

  return (
    <Modal
      open
      onClose={close}
      size="xl"
      title={isSubject ? t('quizcfg_edit_subject', { name: target.name }) : t('quizcfg_edit_category', { name: target.name })}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={resetDefaults}>
            {t('quizcfg_reset_look')}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close}>
              {t('admin_cancel')}
            </Button>
            <Button onClick={onSave} loading={save.isPending} disabled={countInvalid || upload.isPending}>
              {t('admin_save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Live preview with the exact player tile */}
        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('quizcfg_preview')}
          </h4>
          <GameThemeScope>
            <div className={cn('pointer-events-none', isSubject ? 'max-w-sm' : 'max-w-md')}>
              {isSubject ? (
                <SubjectTile
                  item={previewItem}
                  questionCount={countNumber ?? Math.min(target.questionCount, 10)}
                  categoryCount={target.categoryCount ?? 0}
                />
              ) : (
                <CategoryTile
                  item={previewItem}
                  fallbackColorKey={target.subjectColorKey}
                  questionCount={target.questionCount}
                />
              )}
            </div>
          </GameThemeScope>
          {!visible && (
            <p className="text-xs font-medium text-[var(--color-error)]">{t('quizcfg_hidden_preview_note')}</p>
          )}
        </section>

        {/* Icon */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('quizcfg_icon')}</h4>
            <div className="flex gap-1 rounded-full bg-[var(--color-bg-secondary)] p-1" role="tablist">
              {(['gallery', 'image'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    mode === m
                      ? 'bg-[var(--color-brand-gold)] text-white'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  )}
                >
                  {m === 'gallery' ? <LayoutGrid className="size-3.5" /> : <ImageUp className="size-3.5" />}
                  {m === 'gallery' ? t('quizcfg_icon_gallery') : t('quizcfg_icon_image')}
                </button>
              ))}
            </div>
          </div>

          {mode === 'gallery' ? (
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
              <IconChoice
                selected={iconKey === null}
                label={t('quizcfg_icon_default')}
                onClick={() => setIconKey(null)}
              >
                {(() => {
                  const Icon = QUIZ_ICONS[defaultIcon];
                  return <Icon className="size-5" />;
                })()}
                <span className="absolute -bottom-1 rounded-full bg-[var(--color-bg)] px-1 text-[8px] font-bold uppercase text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]">
                  {t('quizcfg_default_short')}
                </span>
              </IconChoice>
              {QUIZ_ICON_KEYS.map((key) => {
                const Icon = QUIZ_ICONS[key];
                return (
                  <IconChoice key={key} selected={iconKey === key} label={key} onClick={() => setIconKey(key)}>
                    <Icon className="size-5" />
                  </IconChoice>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex size-20 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2">
                {imageUrl ? (
                  <img src={imageUrl} alt={t('quizcfg_image_preview_alt')} className="size-full object-contain" />
                ) : (
                  <ImageUp className="size-7 text-[var(--color-text-muted)]" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept={['image/png', 'image/webp', 'image/svg+xml', ...QUIZ_ICON_IMAGE_EXT].join(',')}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                    e.target.value = '';
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    icon={<Upload className="size-4" />}
                    onClick={() => fileRef.current?.click()}
                    loading={upload.isPending}
                  >
                    {imageUrl ? t('quizcfg_image_replace') : t('quizcfg_image_upload')}
                  </Button>
                  {imageUrl && (
                    <Button
                      variant="secondary"
                      icon={<Trash2 className="size-4" />}
                      onClick={() => {
                        setImagePath(null);
                        setMode('gallery');
                      }}
                    >
                      {t('quizcfg_image_remove')}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">{t('quizcfg_image_hint')}</p>
                {uploadError && <p className="text-xs text-[var(--color-error)]">{uploadError}</p>}
              </div>
            </div>
          )}
        </section>

        {/* Color */}
        <section className="flex flex-col gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('quizcfg_color')}</h4>
            <p className="text-xs text-[var(--color-text-muted)]">
              {isSubject ? t('quizcfg_color_hint_subject') : t('quizcfg_color_hint_category')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ColorChoice
              selected={colorKey === null}
              label={t('quizcfg_color_default')}
              swatch={
                isSubject || !target.subjectColorKey
                  ? 'linear-gradient(135deg, var(--quiz-tone-burgundy), var(--quiz-tone-gold))'
                  : `var(--quiz-tone-${target.subjectColorKey})`
              }
              onClick={() => setColorKey(null)}
            />
            {QUIZ_COLOR_KEYS.map((key) => (
              <ColorChoice
                key={key}
                selected={colorKey === key}
                label={t(`quizcfg_tone_${key}`)}
                swatch={`linear-gradient(135deg, var(--quiz-tone-${key}), var(--quiz-tone-${key}-deep))`}
                onClick={() => setColorKey(key)}
              />
            ))}
          </div>
        </section>

        {/* Description */}
        <section className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{t('quizcfg_description')}</span>
            <textarea
              value={description}
              maxLength={140}
              rows={2}
              placeholder={t('quizcfg_description_placeholder')}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(inputClass, 'resize-none')}
            />
          </label>
          <span className="self-end text-xs text-[var(--color-text-muted)]">{description.length}/140</span>
        </section>

        {/* Subject only: questions per quiz */}
        {isSubject && (
          <section className="flex flex-col gap-1">
            <label className="flex flex-col gap-1 sm:max-w-xs">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{t('quizcfg_question_count')}</span>
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                placeholder={t('quizcfg_question_count_placeholder')}
                onChange={(e) => setCount(e.target.value)}
                className={inputClass}
              />
            </label>
            <span className={cn('text-xs', countInvalid ? 'text-[var(--color-error)]' : 'text-[var(--color-text-muted)]')}>
              {countInvalid ? t('quizcfg_question_count_invalid') : t('quizcfg_question_count_hint')}
            </span>
          </section>
        )}

        {/* Visibility */}
        <section>
          <AppSwitch
            checked={visible}
            onChange={setVisible}
            label={t('quizcfg_visible')}
            description={isSubject ? t('quizcfg_visible_hint_subject') : t('quizcfg_visible_hint_category')}
          />
        </section>
      </div>
    </Modal>
  );
}

function IconChoice({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      className={cn(
        'relative flex aspect-square items-center justify-center rounded-xl border transition-all',
        selected
          ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)] ring-2 ring-[var(--color-brand-gold)]/40'
          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold)] hover:text-[var(--color-text-primary)]'
      )}
    >
      {children}
    </button>
  );
}

function ColorChoice({
  selected,
  label,
  swatch,
  onClick,
}: {
  selected: boolean;
  label: string;
  swatch: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      className={cn(
        'relative flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-[var(--color-bg)] transition-transform hover:scale-110',
        selected && 'ring-2 ring-[var(--color-text-primary)]'
      )}
      style={{ background: swatch }}
    >
      {selected && <Check className="size-4 text-white drop-shadow" />}
    </button>
  );
}
