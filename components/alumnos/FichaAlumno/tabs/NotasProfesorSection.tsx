'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, X, Save, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible } from '@/components/common/Collapsible';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { Tooltip } from '@/components/common/Tooltip';
import { Button } from '@/components/common/Button';
import { toChileTime } from '@/lib/hooks/useServerTime';

interface NotaAlumno {
  id: string;
  contenido: string;
  created_at: string;
  updated_at: string;
  autor?: { id: string; nombre: string; apellido: string };
}

interface NotasProfesorSectionProps {
  alumnoId: string;
  notas: NotaAlumno[];
  fmtFecha: (fecha: string) => string;
}

export function NotasProfesorSection({ alumnoId, notas, fmtFecha }: NotasProfesorSectionProps) {
  const tf = useTranslations('ficha');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [newNota, setNewNota] = useState('');
  const [addingNota, setAddingNota] = useState(false);
  const [editingNota, setEditingNota] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteNotaId, setDeleteNotaId] = useState<string | null>(null);

  const createNotaMutation = useMutation({
    mutationFn: async (contenido: string) => {
      const res = await fetch(`/api/alumnos/${alumnoId}/notas-alumno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast.success(tf('nota_creada'));
      setNewNota('');
      setAddingNota(false);
      qc.invalidateQueries({ queryKey: ['ficha-alumno', alumnoId] });
    },
    onError: () => toast.error(tf('nota_error_crear')),
  });

  const deleteNotaMutation = useMutation({
    mutationFn: async (notaId: string) => {
      const res = await fetch(`/api/alumnos/${alumnoId}/notas-alumno/${notaId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      toast.success(tf('nota_eliminada'));
      setDeleteNotaId(null);
      qc.invalidateQueries({ queryKey: ['ficha-alumno', alumnoId] });
    },
    onError: () => toast.error(tf('nota_error_eliminar')),
  });

  const updateNotaMutation = useMutation({
    mutationFn: async ({ notaId, contenido }: { notaId: string; contenido: string }) => {
      const res = await fetch(`/api/alumnos/${alumnoId}/notas-alumno/${notaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      toast.success(tf('nota_actualizada'));
      setEditingNota(null);
      qc.invalidateQueries({ queryKey: ['ficha-alumno', alumnoId] });
    },
    onError: () => toast.error(tf('nota_error_actualizar')),
  });

  return (
    <>
      <Collapsible
        title={tf('notas_profesor')}
        badge={notas.length}
        icon={<ClipboardList className="size-4" />}
        defaultOpen={notas.length > 0}
      >
        <div className="space-y-3">
          {notas.length === 0 && !addingNota && (
            <p className="text-sm text-[var(--color-text-muted)]">{tf('sin_notas_profesor')}</p>
          )}

          {notas.map((nota) => (
            <div
              key={nota.id}
              className="group relative rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
            >
              {editingNota === nota.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateNotaMutation.mutate({ notaId: nota.id, contenido: editContent })}
                      loading={updateNotaMutation.isPending}
                    >
                      <Save className="mr-1 size-3" /> {tc('guardar')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingNota(null)}>
                      <X className="mr-1 size-3" /> {tc('cancelar')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)] pr-12">{nota.contenido}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {fmtFecha(nota.created_at)}
                      {nota.updated_at !== nota.created_at && ` · ${tf('editada')}`}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] shrink-0">
                      {toChileTime(nota.created_at).slice(0, 5)} hrs
                    </p>
                  </div>
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                    <Tooltip content={tc('editar')} position="top">
                      <button
                        onClick={() => { setEditingNota(nota.id); setEditContent(nota.contenido); }}
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip content={tc('eliminar')} position="top">
                      <button
                        onClick={() => setDeleteNotaId(nota.id)}
                        className="rounded p-1 text-[var(--color-error)] hover:bg-[var(--color-error)]/5"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Add nota form */}
          {addingNota ? (
            <div className="space-y-2">
              <textarea
                value={newNota}
                onChange={(e) => setNewNota(e.target.value)}
                rows={3}
                placeholder={tf('nota_placeholder')}
                className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-brand-gold)]/50 bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => { if (newNota.trim()) createNotaMutation.mutate(newNota); }}
                  disabled={!newNota.trim()}
                  loading={createNotaMutation.isPending}
                >
                  <Save className="mr-1 size-3" /> {tc('guardar')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingNota(false); setNewNota(''); }}>
                  <X className="mr-1 size-3" /> {tc('cancelar')}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNota(true)}
              className="flex items-center gap-1.5 text-sm text-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)]/80 transition-colors"
            >
              <Plus className="size-4" /> {tf('agregar_nota')}
            </button>
          )}
        </div>
      </Collapsible>

      {/* Delete nota confirm modal */}
      <ConfirmModal
        open={!!deleteNotaId}
        onClose={() => setDeleteNotaId(null)}
        onConfirm={() => { if (deleteNotaId) deleteNotaMutation.mutate(deleteNotaId); }}
        title={tf('confirmar_eliminar_nota')}
        description={tf('confirmar_eliminar_nota_desc')}
        confirmText={tc('eliminar')}
        cancelText={tc('cancelar')}
        loading={deleteNotaMutation.isPending}
        isDanger
      />
    </>
  );
}
