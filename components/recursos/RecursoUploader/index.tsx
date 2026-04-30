'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, Link2, Video, X, FileText, File, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/gif': 'GIF',
  'audio/mpeg': 'MP3',
  'audio/wav': 'WAV',
  'video/mp4': 'MP4',
  'video/webm': 'WEBM',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'application/zip': 'ZIP',
};

type Tipo = 'archivo' | 'enlace' | 'video';

interface FileEntry {
  file: File;
  displayName: string;
  preview: string;
}

interface UploaderProps {
  alumnos: { id: string; nombre: string; apellido: string }[];
  onSuccess: () => void;
}

export function RecursoUploader({ alumnos, onSuccess }: UploaderProps) {
  const t = useTranslations('recursos');
  const { user } = useUserStore();
  const supabase = createClient();

  const [tipo, setTipo] = useState<Tipo>('archivo');
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [url, setUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [paraToodos, setParaTodos] = useState(true);
  const [selectedAlumnos, setSelectedAlumnos] = useState<string[]>([]);
  const [alumnoSearch, setAlumnoSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Drag handlers ────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, []);

  const addFiles = (incoming: File[]) => {
    const valid: FileEntry[] = [];
    for (const file of incoming) {
      if (!ACCEPTED_TYPES[file.type]) {
        toast.error(`${file.name}: ${t('error_tipo_invalido')}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: ${t('error_tamano')}`);
        continue;
      }
      valid.push({ file, displayName: file.name.replace(/\.[^/.]+$/, ''), preview: file.name });
    }
    setFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const updateDisplayName = (idx: number, name: string) =>
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, displayName: name } : f)));

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
        // Upload each file sequentially
        for (const entry of files) {
          const ext = entry.file.name.split('.').pop();
          const path = `${user.id}/${Date.now()}-${entry.displayName}.${ext}`;

          // Upload to storage
          const { error: storageError } = await supabase.storage
            .from('recursos')
            .upload(path, entry.file, { upsert: false });

          if (storageError) throw storageError;

          setUploadProgress((p) => ({ ...p, [entry.displayName]: 50 }));

          // Insert DB record
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

          // Assign acceso if specific alumnos
          if (!paraToodos && selectedAlumnos.length > 0 && rec) {
            await supabase.from('recursos_acceso').insert(
              selectedAlumnos.map((aid) => ({ recurso_id: rec.id, alumno_id: aid }))
            );
          }

          setUploadProgress((p) => ({ ...p, [entry.displayName]: 100 }));
        }
      } else {
        // Link or video
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
      // Reset form
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

  const filteredAlumnos = alumnos.filter((a) =>
    `${a.nombre} ${a.apellido}`.toLowerCase().includes(alumnoSearch.toLowerCase())
  );

  const toggleAlumno = (id: string) =>
    setSelectedAlumnos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

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
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* File upload zone */}
      {tipo === 'archivo' && (
        <div className="space-y-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            className={cn(
              'cursor-pointer rounded-[var(--radius-lg)] border-2 border-dashed px-6 py-10 text-center transition-colors select-none',
              dragging
                ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-secondary)]'
            )}
          >
            <Upload className={cn('mx-auto h-8 w-8 mb-3', dragging ? 'text-[var(--color-brand-gold)]' : 'text-[var(--color-text-muted)]')} />
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {dragging ? t('drag_drop_activo') : t('drag_drop')}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('formatos_aceptados')}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={Object.keys(ACCEPTED_TYPES).join(',')}
            className="hidden"
            onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
          />

          {/* File list */}
          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((entry, idx) => (
                <li key={idx} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2">
                  <FileText className="h-4 w-4 flex-shrink-0 text-[var(--color-brand-gold)]" />
                  <div className="flex-1 min-w-0">
                    <input
                      value={entry.displayName}
                      onChange={(e) => updateDisplayName(idx, e.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
                      placeholder={t('nombre_display')}
                    />
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{entry.preview}</p>
                    {uploadProgress[entry.displayName] !== undefined && (
                      <div className="mt-1 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-brand-gold)] transition-all duration-300"
                          style={{ width: `${uploadProgress[entry.displayName]}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {uploadProgress[entry.displayName] === 100
                    ? <Check className="h-4 w-4 text-[var(--color-success)]" />
                    : (
                      <button type="button" onClick={() => removeFile(idx)} className="text-[var(--color-text-muted)] hover:text-[var(--color-error)]">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold-muted)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">URL</label>
            <div className="relative">
              {tipo === 'enlace'
                ? <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
                : <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />}
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={tipo === 'video' ? t('url_video_placeholder') : t('url_placeholder')}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold-muted)]"
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
          className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold-muted)]"
        />
      </div>

      {/* Assignment */}
      {alumnos.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('asignar_a')}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setParaTodos(true); setSelectedAlumnos([]); }}
              className={cn(
                'flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors',
                paraToodos
                  ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              )}
            >
              {t('todos_alumnos')}
            </button>
            <button
              type="button"
              onClick={() => setParaTodos(false)}
              className={cn(
                'flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors',
                !paraToodos
                  ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              )}
            >
              {t('alumnos_especificos')}
            </button>
          </div>

          {!paraToodos && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 space-y-1.5 max-h-44 overflow-y-auto">
              <input
                type="text"
                value={alumnoSearch}
                onChange={(e) => setAlumnoSearch(e.target.value)}
                placeholder={t('buscar_alumno')}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)]"
              />
              {filteredAlumnos.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAlumno(a.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm transition-colors text-left',
                    selectedAlumnos.includes(a.id)
                      ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
                  )}
                >
                  <span className={cn(
                    'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                    selectedAlumnos.includes(a.id)
                      ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)]'
                      : 'border-[var(--color-border)]'
                  )}>
                    {selectedAlumnos.includes(a.id) && <Check className="h-2.5 w-2.5 text-white" />}
                  </span>
                  {a.nombre} {a.apellido}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-gold)] transition-all hover:opacity-90 disabled:opacity-50 min-h-[44px]"
      >
        {submitting
          ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />{t('guardando')}</>
          : <><Upload className="h-4 w-4" />{t('guardar')}</>}
      </button>
    </form>
  );
}
