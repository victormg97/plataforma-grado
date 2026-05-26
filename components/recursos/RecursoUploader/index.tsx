'use client';

import { useState } from 'react';
import { Upload, Link2, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { toast } from 'sonner';

import { FileDropZone, type FileEntry } from './components/FileDropZone';
import { AlumnoAssignmentSelector } from './components/AlumnoAssignmentSelector';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tipo = 'archivo' | 'enlace' | 'video';

interface UploaderProps {
  alumnos: { id: string; nombre: string; apellido: string }[];
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecursoUploader({ alumnos, onSuccess }: UploaderProps) {
  const t = useTranslations('recursos');
  const { user } = useUserStore();
  const supabase = createClient();

  const [tipo, setTipo] = useState<Tipo>('archivo');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [url, setUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [paraToodos, setParaTodos] = useState(true);
  const [selectedAlumnos, setSelectedAlumnos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // ── File handlers ────────────────────────────────────────────────
  const addFiles = (incoming: File[]) => {
    const entries: FileEntry[] = incoming.map((file) => ({
      file,
      displayName: file.name.replace(/\.[^/.]+$/, ''),
      preview: file.name,
    }));
    setFiles((prev) => [...prev, ...entries]);
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const updateDisplayName = (idx: number, name: string) =>
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, displayName: name } : f)));

  // ── Alumno toggle ────────────────────────────────────────────────
  const toggleAlumno = (id: string) =>
    setSelectedAlumnos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (tipo === 'archivo' && files.length === 0) {
      toast.error(t('error_nombre'));
      return;
    }
    if ((tipo === 'enlace' || tipo === 'video') && !url.trim()) {
      toast.error(t('error_url'));
      return;
    }
    if ((tipo === 'enlace' || tipo === 'video') && !linkTitle.trim()) {
      toast.error(t('error_nombre'));
      return;
    }
    if (!paraToodos && selectedAlumnos.length === 0) {
      toast.error(t('error_sin_alumnos'));
      return;
    }

    setSubmitting(true);
    try {
      if (tipo === 'archivo') {
        for (const entry of files) {
          const ext = entry.file.name.split('.').pop();
          const path = `${user.id}/${Date.now()}-${entry.displayName}.${ext}`;

          const { error: storageError } = await supabase.storage
            .from('recursos')
            .upload(path, entry.file, { upsert: false });

          if (storageError) throw storageError;

          setUploadProgress((p) => ({ ...p, [entry.displayName]: 50 }));

          const { data: rec, error: dbError } = await supabase
            .from('recursos_compartidos')
            .insert({
              titulo: entry.displayName,
              descripcion: descripcion || null,
              tipo: 'archivo',
              storage_path: path,
              subido_por: user.id,
              para_todos: paraToodos,
            })
            .select('id')
            .single();

          if (dbError) throw dbError;

          if (!paraToodos && selectedAlumnos.length > 0 && rec) {
            await supabase.from('recursos_acceso').insert(
              selectedAlumnos.map((aid) => ({ recurso_id: rec.id, alumno_id: aid }))
            );
          }

          setUploadProgress((p) => ({ ...p, [entry.displayName]: 100 }));
        }
      } else {
        const { data: rec, error: dbError } = await supabase
          .from('recursos_compartidos')
          .insert({
            titulo: linkTitle,
            descripcion: descripcion || null,
            tipo,
            url: url.trim(),
            subido_por: user.id,
            para_todos: paraToodos,
          })
          .select('id')
          .single();

        if (dbError) throw dbError;

        if (!paraToodos && selectedAlumnos.length > 0 && rec) {
          await supabase.from('recursos_acceso').insert(
            selectedAlumnos.map((aid) => ({ recurso_id: rec.id, alumno_id: aid }))
          );
        }
      }

      toast.success(t('exito_subido'));
      setFiles([]);
      setUrl('');
      setLinkTitle('');
      setDescripcion('');
      setParaTodos(true);
      setSelectedAlumnos([]);
      setUploadProgress({});
      onSuccess();
    } catch {
      toast.error(t('error_subir'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-[var(--shadow-sm)] space-y-5"
    >
      {/* Type tabs */}
      <div className="flex gap-1 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-1">
        {([
          { value: 'archivo', Icon: Upload, label: t('tipo_archivo') },
          { value: 'enlace', Icon: Link2, label: t('tipo_enlace') },
          { value: 'video', Icon: Video, label: t('tipo_video') },
        ] as const).map(({ value, Icon, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTipo(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-all',
              tipo === value
                ? 'bg-[var(--color-bg)] text-[var(--color-brand-gold)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* File upload zone */}
      {tipo === 'archivo' && (
        <FileDropZone
          files={files}
          onFilesAdd={addFiles}
          onFileRemove={removeFile}
          onDisplayNameChange={updateDisplayName}
          uploadProgress={uploadProgress}
        />
      )}

      {/* Link / Video URL */}
      {(tipo === 'enlace' || tipo === 'video') && (
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t('nombre_display')}
            </label>
            <input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder={t('nombre_placeholder')}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold-muted)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">URL</label>
            <div className="relative">
              {tipo === 'enlace'
                ? <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
                : <Video className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />}
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={tipo === 'video' ? t('url_video_placeholder') : t('url_placeholder')}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] pl-9 pr-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold-muted)]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t('descripcion')}
        </label>
        <textarea
          rows={2}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={t('descripcion_placeholder')}
          className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold-muted)]"
        />
      </div>

      {/* Assignment */}
      {alumnos.length > 0 && (
        <AlumnoAssignmentSelector
          alumnos={alumnos}
          paraTodos={paraToodos}
          onParaTodosChange={(value) => {
            setParaTodos(value);
            if (value) setSelectedAlumnos([]);
          }}
          selectedAlumnos={selectedAlumnos}
          onToggleAlumno={toggleAlumno}
        />
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-gold)] transition-all hover:opacity-90 disabled:opacity-50 min-h-[44px]"
      >
        {submitting
          ? <><span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />{t('guardando')}</>
          : <><Upload className="size-4" />{t('guardar')}</>}
      </button>
    </form>
  );
}
