'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X, Check, Lightbulb, ChevronDown, Eraser, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { Tooltip } from '@/components/common/Tooltip';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { suggestTagsForText, type SuggestionSource } from '@/lib/question-bank/suggestions';
import { useUiPreference } from '@/lib/hooks/useUiPreference';
import type { QbCategory, QbTag, QbSubject, QbQuestionType, QbDifficulty } from '@/lib/supabase/types';
import { questionTypes, difficulties } from '@/lib/validations/question-bank.schema';

// Difficulty options including null (unrated)
type DifficultyOption = QbDifficulty | null;

interface MatchingPair {
  left: string;
  right: string;
}

interface QuestionFormProps {
  categories: QbCategory[];
  tags: QbTag[];
  subjects: QbSubject[];
  editId: string | null;
  onSaved: () => void;
  onCancelEdit: () => void;
}

interface ChoiceOption {
  text: string;
  is_correct: boolean;
}

const STORAGE_KEY = 'qb-form-draft';

interface FormState {
  type: QbQuestionType;
  content: string;
  options: ChoiceOption[];
  trueFalseAnswer: boolean;
  modelAnswer: string;
  fillBlankAnswers: string[];
  matchingPairs: MatchingPair[];
  explanation: string;
  subjectId: string | null;
  categoryId: string | null;
  selectedTagIds: string[];
  difficulty: DifficultyOption;
}

const DEFAULT_STATE: FormState = {
  type: 'single_choice',
  content: '',
  options: [{ text: '', is_correct: false }, { text: '', is_correct: false }],
  trueFalseAnswer: true,
  modelAnswer: '',
  fillBlankAnswers: [''],
  matchingPairs: [{ left: '', right: '' }, { left: '', right: '' }],
  explanation: '',
  subjectId: null,
  categoryId: null,
  selectedTagIds: [],
  difficulty: null,
};

function loadDraft(): FormState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle fields added in later versions
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return null;
  }
}

function saveDraft(state: FormState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded, ignore */ }
}

function clearDraft() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function QuestionForm({ categories, tags, subjects, editId, onSaved, onCancelEdit }: QuestionFormProps) {
  const t = useTranslations('bancoPreguntas');
  const queryClient = useQueryClient();

  // Load initial state from localStorage (only when creating, not editing)
  const initialState = useMemo(() => {
    if (editId) return DEFAULT_STATE;
    return loadDraft() || DEFAULT_STATE;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Form state
  const [type, setType] = useState<QbQuestionType>(initialState.type);
  const [content, setContent] = useState(initialState.content);
  const [options, setOptions] = useState<ChoiceOption[]>(initialState.options);
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<boolean>(initialState.trueFalseAnswer);
  const [modelAnswer, setModelAnswer] = useState(initialState.modelAnswer);
  const [fillBlankAnswers, setFillBlankAnswers] = useState<string[]>(initialState.fillBlankAnswers);
  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>(initialState.matchingPairs);
  const [explanation, setExplanation] = useState(initialState.explanation);
  // Explanation open/close state persisted per-user in DB
  const [explanationOpen, setExplanationOpen] = useUiPreference<boolean>('qb_explanation_open', false);
  const [subjectId, setSubjectId] = useState<string | null>(initialState.subjectId);
  const [categoryId, setCategoryId] = useState<string | null>(initialState.categoryId);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialState.selectedTagIds);
  const [difficulty, setDifficulty] = useState<DifficultyOption>(initialState.difficulty);
  const [tagSearch, setTagSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  // Auto-save to localStorage on every state change (debounced)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (editId) return; // Don't save drafts when editing existing questions
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft({
        type, content, options, trueFalseAnswer, modelAnswer,
        fillBlankAnswers, matchingPairs, explanation,
        subjectId, categoryId, selectedTagIds, difficulty,
      });
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [type, content, options, trueFalseAnswer, modelAnswer, fillBlankAnswers, matchingPairs, explanation, subjectId, categoryId, selectedTagIds, difficulty, editId]);
  // Load question data for editing
  const { data: editData } = useQuery({
    queryKey: ['qb-question', editId],
    enabled: !!editId,
    queryFn: async () => {
      const res = await fetch(`/api/question-bank/questions/${editId}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  // Populate form when editing
  /* eslint-disable react-hooks/set-state-in-effect -- populating form from fetched data */
  useEffect(() => {
    if (editData) {
      setType(editData.type);
      setContent(editData.content || '');
      setExplanation(editData.explanation || '');
      if (editData.explanation) setExplanationOpen(true);
      setCategoryId(editData.category_id);
      setSubjectId(editData.subject_id || null);
      setDifficulty(editData.difficulty);
      setSelectedTagIds(editData.tags?.map((t: { id: string }) => t.id) || []);

      // Set type-specific options
      if (editData.type === 'single_choice' || editData.type === 'multiple_choice') {
        setOptions(Array.isArray(editData.options) ? editData.options : []);
      } else if (editData.type === 'true_false') {
        setTrueFalseAnswer(editData.options?.correct_answer ?? true);
      } else if (editData.type === 'open_ended') {
        setModelAnswer(editData.options?.model_answer || '');
      } else if (editData.type === 'fill_blank') {
        setFillBlankAnswers(editData.options?.blanks?.[0]?.accepted_answers || ['']);
      } else if (editData.type === 'matching') {
        setMatchingPairs(editData.options?.pairs || [{ left: '', right: '' }, { left: '', right: '' }]);
      }
    }
  }, [editData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Stable callbacks for RichTextEditor to prevent re-render cascades.
  // We store whatever TipTap produces (including '<p></p>' for empty) to avoid
  // the sync effect loop where '' !== '<p></p>' causes infinite setContent calls.
  const handleContentChange = useCallback((html: string) => {
    setContent(html);
  }, []);

  const handleModelAnswerChange = useCallback((html: string) => {
    setModelAnswer(html);
  }, []);

  const handleExplanationChange = useCallback((html: string) => {
    setExplanation(html);
  }, []);

  // Helper: check if rich text content is effectively empty
  const isContentEmpty = (html: string) => {
    if (!html) return true;
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    return stripped.length === 0;
  };

  // Form-level validation for the save button
  const isFormValid = useMemo(() => {
    if (isContentEmpty(content)) return false;

    switch (type) {
      case 'single_choice': {
        const filled = options.filter(o => o.text.trim());
        if (filled.length < 2) return false;
        return filled.some(o => o.is_correct);
      }
      case 'multiple_choice': {
        const filled = options.filter(o => o.text.trim());
        if (filled.length < 2) return false;
        return filled.some(o => o.is_correct);
      }
      case 'true_false':
        return true; // always has a valid answer
      case 'open_ended':
        return true; // content is enough
      case 'fill_blank': {
        const hasAnswer = fillBlankAnswers.some(a => a.trim());
        return hasAnswer;
      }
      case 'matching': {
        const validPairs = matchingPairs.filter(p => p.left.trim() && p.right.trim());
        return validPairs.length >= 2;
      }
      default:
        return true;
    }
  }, [content, type, options, fillBlankAnswers, matchingPairs]);

  // Auto-suggestions
  const categorySources: SuggestionSource[] = useMemo(() => {
    return categories.map(c => ({ id: c.id, name: c.name, keywords: c.keywords || [] }));
  }, [categories]);

  const tagSources: SuggestionSource[] = useMemo(() => {
    return tags.map(t => ({ id: t.id, name: t.name, keywords: t.keywords || [] }));
  }, [tags]);

  const categorySuggestions = useMemo(() => {
    if (isContentEmpty(content)) return [];
    return suggestTagsForText(content, categorySources, 3);
  }, [content, categorySources]);

  const tagSuggestions = useMemo(() => {
    if (isContentEmpty(content)) return [];
    return suggestTagsForText(content, tagSources, 5)
      .filter(s => !selectedTagIds.includes(s.id));
  }, [content, tagSources, selectedTagIds]);

  // Build options payload based on type (filters out empty options)
  const buildOptionsPayload = useCallback(() => {
    switch (type) {
      case 'single_choice':
      case 'multiple_choice':
        return options.filter(o => o.text.trim());
      case 'true_false':
        return { correct_answer: trueFalseAnswer };
      case 'open_ended':
        return { model_answer: modelAnswer || undefined };
      case 'fill_blank': {
        const blanks = fillBlankAnswers
          .map((ans, idx) => ({
            position: idx,
            accepted_answers: ans.split(';').map(a => a.trim()).filter(Boolean),
          }))
          .filter(b => b.accepted_answers.length > 0);
        return { blanks: blanks.length > 0 ? blanks : [{ position: 0, accepted_answers: [] }] };
      }
      case 'matching': {
        const pairs = matchingPairs.filter(p => p.left.trim() && p.right.trim());
        return { pairs };
      }
    }
  }, [type, options, trueFalseAnswer, modelAnswer, fillBlankAnswers, matchingPairs]);

  // Save mutation — always saves as 'active'
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        type,
        content,
        options: buildOptionsPayload(),
        explanation: explanationOpen ? explanation : null,
        subject_id: subjectId,
        category_id: categoryId,
        tag_ids: selectedTagIds,
        difficulty: difficulty,
        status: 'active',
      };

      const url = editId
        ? `/api/question-bank/questions/${editId}`
        : '/api/question-bank/questions';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || 'Error');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t('guardada_ok'), {
        action: {
          label: t('ver_guardadas'),
          onClick: () => onSaved(),
        },
      });
      queryClient.invalidateQueries({ queryKey: ['qb-questions'] });
      if (!editId) {
        applyState(DEFAULT_STATE);
        clearDraft();
      } else {
        // When editing, go back to list after save
        onSaved();
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t('error_guardar'));
    },
  });

  // Create category inline (optimistic)
  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/question-bank/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onMutate: async (name) => {
      // Optimistic: add temp item to cache
      const tempId = `temp-${Date.now()}`;
      queryClient.setQueryData(['qb-categories'], (old: QbCategory[] | undefined) => [
        ...(old || []),
        { id: tempId, tenant: '', name, keywords: [], created_at: '', updated_at: '' },
      ]);
      setCategoryId(tempId);
      setCategorySearch('');
      setCategoryDropdownOpen(false);
      return { tempId };
    },
    onSuccess: (data, _name, context) => {
      // Replace temp with real data
      queryClient.setQueryData(['qb-categories'], (old: QbCategory[] | undefined) =>
        (old || []).map(c => c.id === context?.tempId ? data : c)
      );
      setCategoryId(data.id);
    },
    onError: (_err, _name, context) => {
      queryClient.setQueryData(['qb-categories'], (old: QbCategory[] | undefined) =>
        (old || []).filter(c => c.id !== context?.tempId)
      );
      setCategoryId(null);
    },
  });

  // Create subject inline (optimistic)
  const createSubject = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/question-bank/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onMutate: async (name) => {
      const tempId = `temp-${Date.now()}`;
      queryClient.setQueryData(['qb-subjects'], (old: QbSubject[] | undefined) => [
        ...(old || []),
        { id: tempId, tenant: '', name, keywords: [], created_at: '', updated_at: '' },
      ]);
      setSubjectId(tempId);
      setSubjectSearch('');
      setSubjectDropdownOpen(false);
      return { tempId };
    },
    onSuccess: (data, _name, context) => {
      queryClient.setQueryData(['qb-subjects'], (old: QbSubject[] | undefined) =>
        (old || []).map(s => s.id === context?.tempId ? data : s)
      );
      setSubjectId(data.id);
    },
    onError: (_err, _name, context) => {
      queryClient.setQueryData(['qb-subjects'], (old: QbSubject[] | undefined) =>
        (old || []).filter(s => s.id !== context?.tempId)
      );
      setSubjectId(null);
    },
  });

  // Create tag inline (optimistic)
  const createTag = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/question-bank/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onMutate: async (name) => {
      const tempId = `temp-${Date.now()}`;
      queryClient.setQueryData(['qb-tags'], (old: QbTag[] | undefined) => [
        ...(old || []),
        { id: tempId, tenant: '', name, keywords: [], created_at: '', updated_at: '' },
      ]);
      setSelectedTagIds(prev => [...prev, tempId]);
      setTagSearch('');
      setTagDropdownOpen(false);
      return { tempId };
    },
    onSuccess: (data, _name, context) => {
      queryClient.setQueryData(['qb-tags'], (old: QbTag[] | undefined) =>
        (old || []).map(t => t.id === context?.tempId ? data : t)
      );
      setSelectedTagIds(prev => prev.map(id => id === context?.tempId ? data.id : id));
    },
    onError: (_err, _name, context) => {
      queryClient.setQueryData(['qb-tags'], (old: QbTag[] | undefined) =>
        (old || []).filter(t => t.id !== context?.tempId)
      );
      setSelectedTagIds(prev => prev.filter(id => id !== context?.tempId));
    },
  });

  // Delete category/subject with confirmation
  const [deletingItem, setDeletingItem] = useState<{ type: 'category' | 'subject'; id: string; name: string } | null>(null);

  const deleteItemMutation = useMutation({
    mutationFn: async ({ type: itemType, id }: { type: 'category' | 'subject'; id: string }) => {
      const endpoint = itemType === 'category' ? 'categories' : 'subjects';
      const res = await fetch(`/api/question-bank/${endpoint}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    },
    onSuccess: (_data, variables) => {
      if (variables.type === 'category') {
        queryClient.invalidateQueries({ queryKey: ['qb-categories'] });
        if (categoryId === variables.id) setCategoryId(null);
      } else {
        queryClient.invalidateQueries({ queryKey: ['qb-subjects'] });
        if (subjectId === variables.id) setSubjectId(null);
      }
      setDeletingItem(null);
      toast.success(t('eliminada_ok'));
    },
    onError: () => {
      toast.error(t('error_eliminar'));
    },
  });

  // Apply a full form state (used for undo and reset)
  const applyState = useCallback((s: FormState) => {
    setType(s.type);
    setContent(s.content);
    setOptions(s.options);
    setTrueFalseAnswer(s.trueFalseAnswer);
    setModelAnswer(s.modelAnswer);
    setFillBlankAnswers(s.fillBlankAnswers);
    setMatchingPairs(s.matchingPairs);
    setExplanation(s.explanation);
    setSubjectId(s.subjectId);
    setCategoryId(s.categoryId);
    setSelectedTagIds(s.selectedTagIds);
    setDifficulty(s.difficulty);
  }, []);

  // Get current state as a snapshot (for undo)
  const getSnapshot = useCallback((): FormState => ({
    type, content, options, trueFalseAnswer, modelAnswer,
    fillBlankAnswers, matchingPairs, explanation,
    subjectId, categoryId, selectedTagIds, difficulty,
  }), [type, content, options, trueFalseAnswer, modelAnswer, fillBlankAnswers, matchingPairs, explanation, subjectId, categoryId, selectedTagIds, difficulty]);

  // Clear form with undo toast
  const handleClear = useCallback(() => {
    const snapshot = getSnapshot();
    applyState(DEFAULT_STATE);
    clearDraft();

    toast(t('formulario_limpiado'), {
      action: {
        label: t('deshacer'),
        onClick: () => {
          applyState(snapshot);
          saveDraft(snapshot);
        },
      },
      duration: 5000,
    });
  }, [getSnapshot, applyState, t]);

  // Filter tags for autocomplete dropdown
  const filteredTags = tagSearch.trim()
    ? tags.filter(tag =>
        tag.name.toLowerCase().includes(tagSearch.toLowerCase()) &&
        !selectedTagIds.includes(tag.id)
      )
    : [];

  const filteredCategories = categorySearch.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
    : categories;

  const filteredSubjects = subjectSearch.trim()
    ? subjects.filter(s => s.name.toLowerCase().includes(subjectSearch.toLowerCase()))
    : subjects;

  const showCreateCategory = categorySearch.trim() &&
    !categories.some(c => c.name.toLowerCase() === categorySearch.trim().toLowerCase());

  const showCreateSubject = subjectSearch.trim() &&
    !subjects.some(s => s.name.toLowerCase() === subjectSearch.trim().toLowerCase());

  const showCreateTag = tagSearch.trim() &&
    !tags.some(t => t.name.toLowerCase() === tagSearch.trim().toLowerCase());

  // Action bar component (reused top and bottom)
  const ActionBar = () => (
    <div className="flex items-center justify-between">
      <Button
        variant="ghost"
        size="sm"
        onClick={editId ? onCancelEdit : handleClear}
        disabled={saveMutation.isPending}
      >
        <Eraser className="size-4 mr-1.5" />
        {editId ? t('cancelar_edicion') : t('limpiar')}
      </Button>
      <Button
        size="sm"
        onClick={() => saveMutation.mutate()}
        loading={saveMutation.isPending}
        disabled={!isFormValid}
      >
        {saveMutation.isPending ? t('guardando') : editId ? t('guardar_cambios') : t('guardar')}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Edit mode banner */}
      {editId && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-brand-gold)]/30 bg-[color-mix(in_srgb,var(--color-brand-gold)_8%,transparent)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Edit className="size-4 text-[var(--color-brand-gold)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('editando_pregunta')}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-sm text-[var(--color-brand-gold)] hover:underline font-medium"
          >
            {t('crear_nueva')}
          </button>
        </div>
      )}

      {/* Top action bar */}
      <ActionBar />
      {/* Type selector */}
      <Card className="p-[var(--space-lg)]">
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-3">
          {t('tipo_pregunta')}
        </label>
        <div className="flex flex-wrap gap-2">
          {questionTypes.map((qt) => (
            <button
              key={qt}
              type="button"
              onClick={() => setType(qt)}
              className={`rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-all ${
                type === qt
                  ? 'bg-[var(--color-brand-gold)] text-white shadow-sm'
                  : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)]'
              }`}
            >
              {t(`tipo_${qt}`)}
            </button>
          ))}
        </div>
      </Card>

      {/* Question content */}
      <Card className="p-[var(--space-lg)]">
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {t('enunciado')}
        </label>
        <RichTextEditor
          key="question-content"
          content={content}
          placeholder={t('enunciado_placeholder')}
          onChange={handleContentChange}
        />
      </Card>

      {/* Options section - depends on type */}
      {(type === 'single_choice' || type === 'multiple_choice') && (
        <Card className="p-[var(--space-lg)]">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-3">
            {t('opciones')}
          </label>
          <div className="space-y-3">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Tooltip content={opt.is_correct ? t('desmarcar_correcta') : t('marcar_correcta')}>
                  <button
                    type="button"
                    onClick={() => {
                      if (type === 'single_choice') {
                        setOptions(prev => prev.map((o, i) => ({ ...o, is_correct: i === idx })));
                      } else {
                        setOptions(prev => prev.map((o, i) => i === idx ? { ...o, is_correct: !o.is_correct } : o));
                      }
                    }}
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      opt.is_correct
                        ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)] text-white'
                        : 'border-[var(--color-border)] hover:border-[var(--color-brand-gold)]'
                    }`}
                  >
                    {opt.is_correct && <Check className="size-3.5" />}
                  </button>
                </Tooltip>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    setOptions(prev => {
                      const updated = prev.map((o, i) => i === idx ? { ...o, text: newVal } : o);
                      // Auto-expand: if typing in the last option, add a new empty one
                      if (idx === prev.length - 1 && newVal.trim()) {
                        updated.push({ text: '', is_correct: false });
                      }
                      return updated;
                    });
                  }}
                  placeholder={`${t('opcion_placeholder')} ${idx + 1}`}
                  className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                />
                {/* X clears the field; if it's in the middle, options reorder on save */}
                {options.length > 2 && idx < options.length - 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOptions(prev => {
                        const filtered = prev.filter((_, i) => i !== idx);
                        // Ensure there's always at least one empty slot at the end
                        if (filtered.length < 2 || filtered[filtered.length - 1].text.trim()) {
                          filtered.push({ text: '', is_correct: false });
                        }
                        return filtered;
                      });
                    }}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {type === 'true_false' && (
        <Card className="p-[var(--space-lg)]">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-3">
            {t('respuesta_correcta')}
          </label>
          <div className="flex gap-3">
            {[true, false].map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setTrueFalseAnswer(val)}
                className={`rounded-[var(--radius-md)] px-6 py-2.5 text-sm font-medium transition-all ${
                  trueFalseAnswer === val
                    ? 'bg-[var(--color-brand-gold)] text-white shadow-sm'
                    : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold)]'
                }`}
              >
                {val ? t('verdadero') : t('falso')}
              </button>
            ))}
          </div>
        </Card>
      )}

      {type === 'open_ended' && (
        <Card className="p-[var(--space-lg)]">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t('respuesta_modelo')}
          </label>
          <RichTextEditor
            key="model-answer"
            content={modelAnswer}
            placeholder={t('respuesta_modelo_placeholder')}
            onChange={handleModelAnswerChange}
          />
        </Card>
      )}

      {type === 'fill_blank' && (
        <Card className="p-[var(--space-lg)]">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-3">
            {t('espacios_blanco')}
          </label>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Usa ___ en el enunciado para indicar espacios en blanco (se detectan automáticamente)
          </p>
          {(() => {
            // Auto-detect blanks from content
            const plainContent = content.replace(/<[^>]*>/g, '');
            const blankCount = (plainContent.match(/_{3,}/g) || []).length;
            const displayCount = Math.max(blankCount, 1);
            // Ensure fillBlankAnswers has enough slots
            while (fillBlankAnswers.length < displayCount) {
              fillBlankAnswers.push('');
            }
            return (
              <div className="space-y-3">
                {Array.from({ length: displayCount }).map((_, idx) => (
                  <div key={idx} className="space-y-1.5">
                    {displayCount > 1 && (
                      <p className="text-xs font-medium text-[var(--color-text-muted)]">
                        Espacio {idx + 1}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={fillBlankAnswers[idx] || ''}
                        onChange={(e) => setFillBlankAnswers(prev => {
                          const updated = [...prev];
                          updated[idx] = e.target.value;
                          return updated;
                        })}
                        placeholder={`Respuesta(s) válida(s) separadas por ;`}
                        className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>
      )}

      {/* Matching pairs (two-column, auto-expanding) */}
      {type === 'matching' && (
        <Card className="p-[var(--space-lg)]">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-3">
            {t('matching_par')}es
          </label>
          <div className="space-y-3">
            {matchingPairs.map((pair, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-3 items-center">
                <input
                  type="text"
                  value={pair.left}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    setMatchingPairs(prev => {
                      const updated = prev.map((p, i) => i === idx ? { ...p, left: newVal } : p);
                      if (idx === prev.length - 1 && newVal.trim()) {
                        updated.push({ left: '', right: '' });
                      }
                      return updated;
                    });
                  }}
                  placeholder={`${t('matching_concepto')} ${idx + 1}`}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      setMatchingPairs(prev => {
                        const updated = prev.map((p, i) => i === idx ? { ...p, right: newVal } : p);
                        if (idx === prev.length - 1 && newVal.trim()) {
                          updated.push({ left: '', right: '' });
                        }
                        return updated;
                      });
                    }}
                    placeholder={`${t('matching_definicion')} ${idx + 1}`}
                    className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                  />
                  {matchingPairs.length > 2 && idx < matchingPairs.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setMatchingPairs(prev => {
                        const filtered = prev.filter((_, i) => i !== idx);
                        if (filtered[filtered.length - 1]?.left.trim() || filtered[filtered.length - 1]?.right.trim()) {
                          filtered.push({ left: '', right: '' });
                        }
                        return filtered;
                      })}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors shrink-0"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Explanation (collapsible with animation) */}
      <Card className="p-[var(--space-lg)]">
        <button
          type="button"
          onClick={() => setExplanationOpen(!explanationOpen)}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-brand-gold)] transition-colors"
        >
          <motion.span
            animate={{ rotate: explanationOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="inline-flex"
          >
            <ChevronDown className="size-4" />
          </motion.span>
          {explanationOpen ? t('ocultar_explicacion') : t('mostrar_explicacion')}
        </button>
        <AnimatePresence initial={false}>
          {explanationOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-3">
                <RichTextEditor
                  key="explanation"
                  content={explanation}
                  placeholder={t('explicacion_placeholder')}
                  onChange={handleExplanationChange}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Metadata: materia, category, tags, difficulty */}
      <Card className="p-[var(--space-lg)] space-y-5">
        {/* Subject (Materia) */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
            {t('materia')}
          </label>
          <div className="relative">
            <input
              type="text"
              value={subjectSearch || subjects.find(s => s.id === subjectId)?.name || ''}
              onChange={(e) => {
                setSubjectSearch(e.target.value);
                setSubjectDropdownOpen(true);
                if (!e.target.value) setSubjectId(null);
              }}
              onFocus={() => {
                setSubjectSearch(subjects.find(s => s.id === subjectId)?.name || '');
                setSubjectDropdownOpen(true);
              }}
              onBlur={() => setTimeout(() => setSubjectDropdownOpen(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && subjectSearch.trim() && showCreateSubject) {
                  e.preventDefault();
                  createSubject.mutate(subjectSearch.trim());
                }
              }}
              placeholder={t('materia_placeholder')}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            />
            {subjectDropdownOpen && (filteredSubjects.length > 0 || showCreateSubject) && (
              <div className="absolute z-10 mt-1 w-full max-h-[200px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] shadow-[var(--shadow-lg)]">
                {filteredSubjects.map(s => (
                  <div key={s.id} className="flex items-center group">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSubjectId(s.id); setSubjectSearch(''); setSubjectDropdownOpen(false); }}
                      className="flex-1 px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                    >
                      {s.name}
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSubjectDropdownOpen(false); setDeletingItem({ type: 'subject', id: s.id, name: s.name }); }}
                      className="px-2 py-2 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-error)] transition-all"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {showCreateSubject && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => createSubject.mutate(subjectSearch.trim())}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--color-brand-gold)] font-medium hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <Plus className="inline size-3.5 mr-1" />
                    {t('crear_materia', { name: subjectSearch.trim() })}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
            {t('categoria')}
          </label>
          <div className="relative">
            <input
              type="text"
              value={categorySearch || categories.find(c => c.id === categoryId)?.name || ''}
              onChange={(e) => {
                setCategorySearch(e.target.value);
                setCategoryDropdownOpen(true);
                if (!e.target.value) setCategoryId(null);
              }}
              onFocus={() => {
                setCategorySearch(categories.find(c => c.id === categoryId)?.name || '');
                setCategoryDropdownOpen(true);
              }}
              onBlur={() => {
                // Delay to allow click on dropdown items
                setTimeout(() => setCategoryDropdownOpen(false), 200);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && categorySearch.trim() && showCreateCategory) {
                  e.preventDefault();
                  createCategory.mutate(categorySearch.trim());
                }
              }}
              placeholder={t('categoria_placeholder')}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            />
            {categoryDropdownOpen && (filteredCategories.length > 0 || showCreateCategory) && (
              <div className="absolute z-10 mt-1 w-full max-h-[200px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] shadow-[var(--shadow-lg)]">
                {filteredCategories.map(c => (
                  <div key={c.id} className="flex items-center group">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setCategoryId(c.id); setCategorySearch(''); setCategoryDropdownOpen(false); }}
                      className="flex-1 px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                    >
                      {c.name}
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setCategoryDropdownOpen(false); setDeletingItem({ type: 'category', id: c.id, name: c.name }); }}
                      className="px-2 py-2 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-error)] transition-all"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {showCreateCategory && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { createCategory.mutate(categorySearch.trim()); setCategoryDropdownOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--color-brand-gold)] font-medium hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <Plus className="inline size-3.5 mr-1" />
                    {t('crear_categoria', { name: categorySearch.trim() })}
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Category suggestions */}
          {categorySuggestions.length > 0 && !categoryId && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Lightbulb className="size-3.5 text-[var(--color-brand-gold)]" />
              <span className="text-xs text-[var(--color-text-muted)]">{t('sugerencia_categoria')}:</span>
              {categorySuggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setCategoryId(s.id); setCategorySearch(''); }}
                  className="rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-gold)] hover:bg-[color-mix(in_srgb,var(--color-brand-gold)_20%,transparent)] transition-colors"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
            {t('tags')}
          </label>
          {/* Selected tags */}
          {selectedTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedTagIds.map(tagId => {
                const tag = tags.find(t => t.id === tagId);
                if (!tag) return null;
                return (
                  <span
                    key={tagId}
                    className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--color-brand-gold)]"
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => setSelectedTagIds(prev => prev.filter(id => id !== tagId))}
                      className="hover:text-[var(--color-error)] transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {/* Tag input */}
          <div className="relative">
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => { setTagSearch(e.target.value); setTagDropdownOpen(true); }}
              onFocus={() => setTagDropdownOpen(true)}
              onBlur={() => setTimeout(() => setTagDropdownOpen(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagSearch.trim() && showCreateTag) {
                  e.preventDefault();
                  createTag.mutate(tagSearch.trim());
                }
              }}
              placeholder={t('tags_placeholder')}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            />
            {tagDropdownOpen && tagSearch && (filteredTags.length > 0 || showCreateTag) && (
              <div className="absolute z-10 mt-1 w-full max-h-[200px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] shadow-[var(--shadow-lg)]">
                {filteredTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setSelectedTagIds(prev => [...prev, tag.id]); setTagSearch(''); setTagDropdownOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    {tag.name}
                  </button>
                ))}
                {showCreateTag && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { createTag.mutate(tagSearch.trim()); setTagDropdownOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--color-brand-gold)] font-medium hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <Plus className="inline size-3.5 mr-1" />
                    {t('crear_tag', { name: tagSearch.trim() })}
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Tag suggestions */}
          {tagSuggestions.length > 0 && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Lightbulb className="size-3.5 text-[var(--color-brand-gold)]" />
              <span className="text-xs text-[var(--color-text-muted)]">{t('sugerencia_tags')}:</span>
              {tagSuggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedTagIds(prev => [...prev, s.id])}
                  className="rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-gold)] hover:bg-[color-mix(in_srgb,var(--color-brand-gold)_20%,transparent)] transition-colors"
                >
                  + {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t('dificultad')}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDifficulty(null)}
              className={`rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-all ${
                difficulty === null
                  ? 'bg-[var(--color-text-muted)] text-white shadow-sm'
                  : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)]'
              }`}
            >
              {t('dificultad_sin')}
            </button>
            {difficulties.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-all ${
                  difficulty === d
                    ? d === 'easy'
                      ? 'bg-green-600 text-white shadow-sm'
                      : d === 'medium'
                      ? 'bg-yellow-500 text-white shadow-sm'
                      : 'bg-red-600 text-white shadow-sm'
                    : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)]'
                }`}
              >
                {t(`dificultad_${d}`)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Bottom action bar */}
      <ActionBar />

      {/* Delete confirmation for categories/subjects */}
      <ConfirmModal
        open={deletingItem !== null}
        onClose={() => setDeletingItem(null)}
        onConfirm={() => { if (deletingItem) deleteItemMutation.mutate(deletingItem); }}
        title={`${t('confirmar_eliminar_item')}`}
        description={`"${deletingItem?.name}" — ${t('confirmar_eliminar_item_desc')}`}
        confirmText={t('eliminar')}
        loading={deleteItemMutation.isPending}
      />
    </div>
  );
}
