'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X, FileText, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const ACCEPTED_TYPES: Record<string, string> = {
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileEntry {
  file: File;
  displayName: string;
  preview: string;
}

export interface FileDropZoneProps {
  files: FileEntry[];
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onDisplayNameChange: (index: number, name: string) => void;
  uploadProgress: Record<string, number>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileDropZone({
  files,
  onFilesAdd,
  onFileRemove,
  onDisplayNameChange,
  uploadProgress,
}: FileDropZoneProps) {
  const t = useTranslations('recursos');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const incoming = Array.from(e.dataTransfer.files);
    const valid = validateFiles(incoming);
    if (valid.length > 0) onFilesAdd(valid);
  }, [onFilesAdd]);

  function validateFiles(incoming: File[]): File[] {
    const valid: File[] = [];
    for (const file of incoming) {
      if (!ACCEPTED_TYPES[file.type]) {
        toast.error(`${file.name}: ${t('error_tipo_invalido')}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: ${t('error_tamano')}`);
        continue;
      }
      valid.push(file);
    }
    return valid;
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    const valid = validateFiles(incoming);
    if (valid.length > 0) onFilesAdd(valid);
  }

  return (
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
        <Upload className={cn('mx-auto size-8 mb-3', dragging ? 'text-[var(--color-brand-gold)]' : 'text-[var(--color-text-muted)]')} />
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
        onChange={handleInputChange}
      />

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((entry, idx) => (
            <li key={idx} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2">
              <FileText className="size-4 flex-shrink-0 text-[var(--color-brand-gold)]" />
              <div className="flex-1 min-w-0">
                <input
                  value={entry.displayName}
                  onChange={(e) => onDisplayNameChange(idx, e.target.value)}
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
                ? <Check className="size-4 text-[var(--color-success)]" />
                : (
                  <button type="button" onClick={() => onFileRemove(idx)} className="text-[var(--color-text-muted)] hover:text-[var(--color-error)]">
                    <X className="size-4" />
                  </button>
                )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
