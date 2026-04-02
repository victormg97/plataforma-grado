'use client';

import { useState } from 'react';
import { Plus, Trash2, BookOpen, FileText, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/common/Button';
import { Tooltip } from '@/components/common/Tooltip';
import type { ClasePrograma } from '@/lib/supabase/types';

type ClaseItem = Pick<ClasePrograma, 'id' | 'nombre' | 'tipo' | 'orden'> & {
  descripcion?: string | null;
  duracion_min?: number | null;
  tempId?: string;
};

interface ClasesEditorProps {
  clases: ClaseItem[];
  savedClases: ClaseItem[]; // the persisted snapshot for revert
  onChange: (clases: ClaseItem[]) => void;
  duracionDefault?: number;
  readOnly?: boolean;
  saving?: boolean;
  onSave?: (clases: ClaseItem[]) => Promise<void>;
}

export function ClasesEditor({
  clases,
  savedClases,
  onChange,
  duracionDefault = 60,
  readOnly = false,
  saving = false,
  onSave,
}: ClasesEditorProps) {
  const t = useTranslations('programas');
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const addClase = (tipo: 'materia' | 'prueba') => {
    const maxOrden = Math.max(0, ...clases.map((c) => c.orden));
    const newClase: ClaseItem = {
      tempId: `temp-${Date.now()}`,
      id: '',
      nombre: tipo === 'materia' ? t('editor.nueva_clase') : t('editor.nueva_prueba'),
      tipo,
      orden: maxOrden + 1,
      duracion_min: duracionDefault,
      descripcion: null,
    };
    onChange([...clases, newClase]);
  };

  const updateClase = (key: string, field: keyof ClaseItem, value: unknown) => {
    onChange(
      clases.map((c) => {
        const match = c.tempId ? c.tempId === key : c.id === key;
        return match ? { ...c, [field]: value } : c;
      })
    );
  };

  const removeClase = (key: string) => {
    onChange(clases.filter((c) => (c.tempId ? c.tempId !== key : c.id !== key)));
  };

  const moveClase = (key: string, dir: -1 | 1) => {
    const idx = clases.findIndex((c) => (c.tempId ? c.tempId === key : c.id === key));
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= clases.length) return;
    const next = [...clases];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    const reordered = next.map((c, i) => ({ ...c, orden: i + 1 }));
    onChange(reordered);
  };

  const handleRevert = () => {
    onChange(savedClases);
  };

  const handleSave = () => {
    const invalid = clases.find((c) => !c.nombre.trim());
    if (invalid) {
      toast.error(t('editor.nombre_requerido'));
      return;
    }
    onSave?.(clases);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Lista de clases */}
      <div className="flex flex-col gap-2">
        {clases.length === 0 && (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-6">
            {t('editor.sin_clases')}
          </p>
        )}
        {clases
          .sort((a, b) => a.orden - b.orden)
          .map((clase, idx) => {
            const key = clase.tempId ?? clase.id;
            const isFocused = focusedKey === key;
            const hasDesc = !!clase.descripcion;
            const isEmpty = !clase.nombre.trim();

            return (
              <div
                key={key}
                className={cn(
                  'rounded-[var(--radius-sm)] border bg-[var(--color-bg)] transition-all group',
                  isEmpty
                    ? 'border-[var(--color-error)]/60'
                    : clase.tipo === 'prueba'
                    ? 'border-[var(--color-brand-gold)]/50 border-l-2 border-l-[var(--color-brand-gold)]'
                    : 'border-[var(--color-border)]',
                  (isFocused || hasDesc) && 'shadow-sm'
                )}
                onFocus={() => setFocusedKey(key)}
                onBlur={(e) => {
                  // Only clear focus if leaving the whole card
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setFocusedKey(null);
                  }
                }}
              >
                {/* Top row: order, icon, name, duration, arrows, delete */}
                <div className="flex items-center gap-2 px-2 pt-2 pb-1">
                  {/* Orden indicator */}
                  <div
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                      isEmpty
                        ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
                    )}
                  >
                    {idx + 1}
                  </div>

                  {/* Type icon */}
                  <div className="shrink-0">
                    {clase.tipo === 'prueba' ? (
                      <FileText className="h-4 w-4 text-[var(--color-brand-gold)]" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-[var(--color-text-muted)]" />
                    )}
                  </div>

                  {/* Nombre input */}
                  {readOnly ? (
                    <span className="flex-1 truncate text-sm text-[var(--color-text-primary)]">
                      {clase.nombre}
                    </span>
                  ) : (
                    <input
                      value={clase.nombre}
                      onChange={(e) => updateClase(key, 'nombre', e.target.value)}
                      onFocus={(e) => {
                        const isDefault =
                          clase.nombre === t('editor.nueva_clase') ||
                          clase.nombre === t('editor.nueva_prueba');
                        if (isDefault) e.target.select();
                      }}
                      className={cn(
                        'min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)] focus:underline',
                        isEmpty
                          ? 'text-[var(--color-error)] placeholder:text-[var(--color-error)]/50'
                          : 'text-[var(--color-text-primary)]'
                      )}
                      placeholder={t('editor.nombre_placeholder')}
                    />
                  )}

                  {/* Duración */}
                  {!readOnly && (
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        value={clase.duracion_min ?? duracionDefault}
                        onChange={(e) => updateClase(key, 'duracion_min', Number(e.target.value))}
                        min={15}
                        max={480}
                        className="w-14 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-center text-xs text-[var(--color-text-muted)] outline-none"
                      />
                      <span className="text-xs text-[var(--color-text-muted)]">min</span>
                    </div>
                  )}

                  {/* Move up/down + Delete — grouped so there's no gap between arrows and trash */}
                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <div className="flex flex-col gap-0.5">
                        <Tooltip content={t('editor.mover_arriba')} position="left" variant="subtle">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveClase(key, -1)}
                            className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30 text-[10px] leading-none transition-colors"
                          >
                            ▲
                          </button>
                        </Tooltip>
                        <Tooltip content={t('editor.mover_abajo')} position="left" variant="subtle">
                          <button
                            type="button"
                            disabled={idx === clases.length - 1}
                            onClick={() => moveClase(key, 1)}
                            className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30 text-[10px] leading-none transition-colors"
                          >
                            ▼
                          </button>
                        </Tooltip>
                      </div>
                      <Tooltip content={t('editor.eliminar_clase_tooltip')} position="left">
                        <button
                          type="button"
                          onClick={() => removeClase(key)}
                          className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-red-50 hover:text-[var(--color-error)] dark:hover:bg-red-950/20 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </div>

                {/* Description row — only shown when card is focused OR when it has content */}
                {!readOnly && (
                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-200',
                      isFocused || hasDesc ? 'max-h-20 pb-2' : 'max-h-0'
                    )}
                  >
                    <input
                      value={clase.descripcion ?? ''}
                      onChange={(e) => updateClase(key, 'descripcion', e.target.value || null)}
                      className="w-full bg-transparent pl-9 pr-2 text-xs text-[var(--color-text-muted)] outline-none placeholder:text-[var(--color-text-muted)]/40 italic"
                      placeholder={t('editor.descripcion_placeholder')}
                    />
                  </div>
                )}

                {/* Read-only description */}
                {readOnly && hasDesc && (
                  <p className="pb-2 pl-9 pr-2 text-xs italic text-[var(--color-text-muted)]">
                    {clase.descripcion}
                  </p>
                )}
              </div>
            );
          })}
      </div>

      {/* Add buttons + Revert + Save */}
      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip content={t('editor.agregar_clase_tooltip')} position="bottom">
            <button
              type="button"
              onClick={() => addClase('materia')}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-text-secondary)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold)]/5 active:scale-[0.98] transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('editor.agregar_clase')}
            </button>
          </Tooltip>

          <Tooltip content={t('editor.agregar_prueba_tooltip')} position="bottom">
            <button
              type="button"
              onClick={() => addClase('prueba')}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-brand-gold)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold)]/10 active:scale-[0.98] transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('editor.agregar_prueba')}
            </button>
          </Tooltip>

          <div className="ml-auto flex items-center gap-2">
            {onSave && (
              <Tooltip content={t('editor.revertir_tooltip')} position="top">
                <button
                  type="button"
                  onClick={handleRevert}
                  className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('editor.revertir_cambios')}
                </button>
              </Tooltip>
            )}

            {onSave && (
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                onClick={handleSave}
              >
                {t('editor.guardar_cambios')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
