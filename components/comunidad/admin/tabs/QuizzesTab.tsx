'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, EyeOff, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { AppSwitch } from '@/components/common/AppSwitch';
import {
  useAdminQuizConfig,
  useReorderQuizItems,
  useSaveQuizItem,
} from '@/lib/hooks/useComunidadAdmin';
import type {
  AdminQuizCategoryConfig,
  AdminQuizSubjectConfig,
  QuizDisplaySettings,
} from '@/lib/comunidad/quiz-display';
import { QuizItemIcon, quizIconUrl, quizToneStyle } from '@/components/comunidad/quiz/QuizItemIcon';
import { ConfigCallout } from '../ui';
import { QuizItemEditorModal, type QuizEditorTarget } from '../quizzes/QuizItemEditorModal';

/**
 * "Cuestionarios" config tab: every subject of the question bank, expandable
 * to its categories. For each one the admin can set icon (gallery or own
 * image), color, description, visibility and order; subjects also set the
 * questions per quiz. Changes show in the players' pickers.
 */
export function QuizzesTab() {
  const t = useTranslations('comunidadEstrategica');
  const { data, isLoading, isError, refetch } = useAdminQuizConfig();
  const reorder = useReorderQuizItems();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<QuizEditorTarget | null>(null);

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

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const move = <T extends { id: string }>(list: T[], index: number, dir: -1 | 1, subjectId: string | null) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((x) => x.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(
      { subject_id: subjectId, ids },
      { onError: () => toast.error(t('admin_error')) }
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <ConfigCallout title={t('quizcfg_intro_title')}>{t('quizcfg_intro_desc')}</ConfigCallout>

      {data.length === 0 ? (
        <Card padding="lg" className="flex flex-col items-center gap-2 py-10 text-center">
          <BookOpen className="size-8 text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-text-muted)]">{t('quizcfg_empty')}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((subject, i) => (
            <SubjectRow
              key={subject.id}
              subject={subject}
              index={i}
              total={data.length}
              expanded={open.has(subject.id)}
              onToggle={() => toggle(subject.id)}
              onMove={(dir) => move(data, i, dir, null)}
              onMoveCategory={(ci, dir) => move(subject.categories, ci, dir, subject.id)}
              onEdit={setEditing}
            />
          ))}
        </ul>
      )}

      {editing && (
        <QuizItemEditorModal
          key={`${editing.subjectId}:${editing.categoryId ?? ''}`}
          target={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SubjectRow({
  subject,
  index,
  total,
  expanded,
  onToggle,
  onMove,
  onMoveCategory,
  onEdit,
}: {
  subject: AdminQuizSubjectConfig;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onMoveCategory: (index: number, dir: -1 | 1) => void;
  onEdit: (target: QuizEditorTarget) => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const save = useSaveQuizItem();
  const s = subject.settings;
  const panelId = `quizcfg-${subject.id}`;

  const setVisible = (visible: boolean) =>
    save.mutate(
      { subject_id: subject.id, category_id: null, patch: { is_hidden: !visible } },
      { onError: () => toast.error(t('admin_error')) }
    );

  const editSubject = () =>
    onEdit({
      kind: 'subject',
      subjectId: subject.id,
      categoryId: null,
      name: subject.name,
      questionCount: subject.question_count,
      categoryCount: subject.categories.length,
      settings: s,
    });

  return (
    <li>
      <Card padding="md" className={cn('flex flex-col gap-0', s.is_hidden && 'opacity-80')}>
        <div className="flex flex-wrap items-center gap-3">
          <Reorder
            onUp={() => onMove(-1)}
            onDown={() => onMove(1)}
            upDisabled={index === 0}
            downDisabled={index === total - 1}
          />
          <IconPreview settings={s} fallback="book-open" size="lg" />

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold text-[var(--color-text-primary)]">{subject.name}</span>
                {s.is_hidden && <HiddenBadge />}
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                {t('quizcfg_subject_meta', {
                  questions: subject.question_count,
                  categories: subject.categories.length,
                })}
                {s.quiz_question_count ? ` · ${t('quizcfg_per_quiz', { count: s.quiz_question_count })}` : ''}
              </p>
            </div>
            <ChevronDown
              className={cn('size-5 shrink-0 text-[var(--color-text-muted)] transition-transform', expanded && 'rotate-180')}
            />
          </button>

          <div className="flex items-center gap-3">
            <AppSwitch size="sm" checked={!s.is_hidden} onChange={setVisible} label={t('quizcfg_visible')} />
            <Button variant="secondary" size="sm" icon={<Pencil className="size-3.5" />} onClick={editSubject}>
              {t('quizcfg_edit')}
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <m.div
              id={panelId}
              key="cats"
              initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t('quizcfg_categories_title')}
                </h4>
                {subject.categories.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)]">{t('quizcfg_no_categories')}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {subject.categories.map((c, ci) => (
                      <CategoryRow
                        key={c.id}
                        subject={subject}
                        category={c}
                        index={ci}
                        total={subject.categories.length}
                        onMove={(dir) => onMoveCategory(ci, dir)}
                        onEdit={onEdit}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </Card>
    </li>
  );
}

function CategoryRow({
  subject,
  category,
  index,
  total,
  onMove,
  onEdit,
}: {
  subject: AdminQuizSubjectConfig;
  category: AdminQuizCategoryConfig;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onEdit: (target: QuizEditorTarget) => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const save = useSaveQuizItem();
  const s = category.settings;

  const setVisible = (visible: boolean) =>
    save.mutate(
      { subject_id: subject.id, category_id: category.id, patch: { is_hidden: !visible } },
      { onError: () => toast.error(t('admin_error')) }
    );

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2',
        s.is_hidden && 'opacity-80'
      )}
    >
      <Reorder onUp={() => onMove(-1)} onDown={() => onMove(1)} upDisabled={index === 0} downDisabled={index === total - 1} />
      <IconPreview settings={s} fallback="layers" fallbackColorKey={subject.settings.color_key} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">{category.name}</span>
          {s.is_hidden && <HiddenBadge />}
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          {t('quiz_subject_count', { count: category.question_count })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <AppSwitch size="sm" checked={!s.is_hidden} onChange={setVisible} label={t('quizcfg_visible')} />
        <Button
          variant="secondary"
          size="sm"
          icon={<Pencil className="size-3.5" />}
          onClick={() =>
            onEdit({
              kind: 'category',
              subjectId: subject.id,
              categoryId: category.id,
              name: category.name,
              questionCount: category.question_count,
              subjectColorKey: subject.settings.color_key,
              settings: s,
            })
          }
        >
          {t('quizcfg_edit')}
        </Button>
      </div>
    </li>
  );
}

function IconPreview({
  settings,
  fallback,
  fallbackColorKey,
  size = 'md',
}: {
  settings: QuizDisplaySettings;
  fallback: 'book-open' | 'layers';
  fallbackColorKey?: string | null;
  size?: 'md' | 'lg';
}) {
  const hasImage = !!quizIconUrl(settings.icon_image_path);
  return (
    <span
      style={quizToneStyle(settings.color_key ?? fallbackColorKey)}
      className={cn(
        'flex shrink-0 items-center justify-center text-white',
        size === 'lg' ? 'size-11 rounded-xl' : 'size-9 rounded-lg',
        hasImage
          ? 'bg-white p-1 ring-1 ring-[var(--color-border)]'
          : 'bg-[linear-gradient(135deg,var(--tone),var(--tone-deep))]'
      )}
    >
      <QuizItemIcon
        iconKey={settings.icon_key}
        imagePath={settings.icon_image_path}
        fallback={fallback}
        className={hasImage ? 'size-full' : size === 'lg' ? 'size-5' : 'size-4'}
      />
    </span>
  );
}

function HiddenBadge() {
  const t = useTranslations('comunidadEstrategica');
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-error)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-error)]">
      <EyeOff className="size-3" />
      {t('quizcfg_hidden')}
    </span>
  );
}

function Reorder({
  onUp,
  onDown,
  upDisabled,
  downDisabled,
}: {
  onUp: () => void;
  onDown: () => void;
  upDisabled: boolean;
  downDisabled: boolean;
}) {
  const t = useTranslations('comunidadEstrategica');
  const btn =
    'flex size-6 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:pointer-events-none disabled:opacity-30';
  return (
    <div className="flex flex-col">
      <button type="button" onClick={onUp} disabled={upDisabled} aria-label={t('quizcfg_move_up')} className={btn}>
        <ArrowUp className="size-3.5" />
      </button>
      <button type="button" onClick={onDown} disabled={downDisabled} aria-label={t('quizcfg_move_down')} className={btn}>
        <ArrowDown className="size-3.5" />
      </button>
    </div>
  );
}
