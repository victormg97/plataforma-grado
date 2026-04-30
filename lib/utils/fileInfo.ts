/**
 * File type detection utility for recursos compartidos.
 * Maps file extensions to icons (from lucide-react), colors, and labels.
 */

import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  File,
  type LucideIcon,
} from 'lucide-react';

export interface FileInfo {
  ext: string;           // uppercase extension e.g. "PDF"
  Icon: LucideIcon;      // lucide icon component
  iconColor: string;     // CSS color class
  iconBg: string;        // CSS background class
  badgeColor: string;    // badge text + bg CSS classes (combined)
  canPreview: boolean;   // whether we can render inline in a modal
  previewType: 'pdf' | 'image' | 'video' | 'audio' | 'none';
}

const EXT_MAP: Record<string, Omit<FileInfo, 'ext'>> = {
  // Documents
  pdf: {
    Icon: FileText,
    iconColor: 'text-[#E44D26]',
    iconBg: 'bg-[rgba(228,77,38,0.1)]',
    badgeColor: 'bg-[rgba(228,77,38,0.12)] text-[#E44D26]',
    canPreview: true,
    previewType: 'pdf',
  },
  doc: {
    Icon: FileText,
    iconColor: 'text-[#2B579A]',
    iconBg: 'bg-[rgba(43,87,154,0.1)]',
    badgeColor: 'bg-[rgba(43,87,154,0.12)] text-[#2B579A]',
    canPreview: false,
    previewType: 'none',
  },
  docx: {
    Icon: FileText,
    iconColor: 'text-[#2B579A]',
    iconBg: 'bg-[rgba(43,87,154,0.1)]',
    badgeColor: 'bg-[rgba(43,87,154,0.12)] text-[#2B579A]',
    canPreview: false,
    previewType: 'none',
  },
  txt: {
    Icon: FileText,
    iconColor: 'text-[var(--color-text-muted)]',
    iconBg: 'bg-[var(--color-bg-secondary)]',
    badgeColor: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
    canPreview: false,
    previewType: 'none',
  },
  // Images
  jpg: {
    Icon: FileImage,
    iconColor: 'text-[#A855F7]',
    iconBg: 'bg-[rgba(168,85,247,0.1)]',
    badgeColor: 'bg-[rgba(168,85,247,0.12)] text-[#A855F7]',
    canPreview: true,
    previewType: 'image',
  },
  jpeg: {
    Icon: FileImage,
    iconColor: 'text-[#A855F7]',
    iconBg: 'bg-[rgba(168,85,247,0.1)]',
    badgeColor: 'bg-[rgba(168,85,247,0.12)] text-[#A855F7]',
    canPreview: true,
    previewType: 'image',
  },
  png: {
    Icon: FileImage,
    iconColor: 'text-[#A855F7]',
    iconBg: 'bg-[rgba(168,85,247,0.1)]',
    badgeColor: 'bg-[rgba(168,85,247,0.12)] text-[#A855F7]',
    canPreview: true,
    previewType: 'image',
  },
  gif: {
    Icon: FileImage,
    iconColor: 'text-[#A855F7]',
    iconBg: 'bg-[rgba(168,85,247,0.1)]',
    badgeColor: 'bg-[rgba(168,85,247,0.12)] text-[#A855F7]',
    canPreview: true,
    previewType: 'image',
  },
  webp: {
    Icon: FileImage,
    iconColor: 'text-[#A855F7]',
    iconBg: 'bg-[rgba(168,85,247,0.1)]',
    badgeColor: 'bg-[rgba(168,85,247,0.12)] text-[#A855F7]',
    canPreview: true,
    previewType: 'image',
  },
  svg: {
    Icon: FileImage,
    iconColor: 'text-[#F59E0B]',
    iconBg: 'bg-[rgba(245,158,11,0.1)]',
    badgeColor: 'bg-[rgba(245,158,11,0.12)] text-[#F59E0B]',
    canPreview: true,
    previewType: 'image',
  },
  // Video
  mp4: {
    Icon: FileVideo,
    iconColor: 'text-[var(--color-error)]',
    iconBg: 'bg-[rgba(192,57,43,0.1)]',
    badgeColor: 'bg-[rgba(192,57,43,0.12)] text-[var(--color-error)]',
    canPreview: true,
    previewType: 'video',
  },
  webm: {
    Icon: FileVideo,
    iconColor: 'text-[var(--color-error)]',
    iconBg: 'bg-[rgba(192,57,43,0.1)]',
    badgeColor: 'bg-[rgba(192,57,43,0.12)] text-[var(--color-error)]',
    canPreview: true,
    previewType: 'video',
  },
  mov: {
    Icon: FileVideo,
    iconColor: 'text-[var(--color-error)]',
    iconBg: 'bg-[rgba(192,57,43,0.1)]',
    badgeColor: 'bg-[rgba(192,57,43,0.12)] text-[var(--color-error)]',
    canPreview: true,
    previewType: 'video',
  },
  // Audio
  mp3: {
    Icon: FileAudio,
    iconColor: 'text-[#06B6D4]',
    iconBg: 'bg-[rgba(6,182,212,0.1)]',
    badgeColor: 'bg-[rgba(6,182,212,0.12)] text-[#06B6D4]',
    canPreview: true,
    previewType: 'audio',
  },
  wav: {
    Icon: FileAudio,
    iconColor: 'text-[#06B6D4]',
    iconBg: 'bg-[rgba(6,182,212,0.1)]',
    badgeColor: 'bg-[rgba(6,182,212,0.12)] text-[#06B6D4]',
    canPreview: true,
    previewType: 'audio',
  },
  // Spreadsheets
  xls: {
    Icon: FileSpreadsheet,
    iconColor: 'text-[#217346]',
    iconBg: 'bg-[rgba(33,115,70,0.1)]',
    badgeColor: 'bg-[rgba(33,115,70,0.12)] text-[#217346]',
    canPreview: false,
    previewType: 'none',
  },
  xlsx: {
    Icon: FileSpreadsheet,
    iconColor: 'text-[#217346]',
    iconBg: 'bg-[rgba(33,115,70,0.1)]',
    badgeColor: 'bg-[rgba(33,115,70,0.12)] text-[#217346]',
    canPreview: false,
    previewType: 'none',
  },
  csv: {
    Icon: FileSpreadsheet,
    iconColor: 'text-[#217346]',
    iconBg: 'bg-[rgba(33,115,70,0.1)]',
    badgeColor: 'bg-[rgba(33,115,70,0.12)] text-[#217346]',
    canPreview: false,
    previewType: 'none',
  },
  // Code / data
  json: {
    Icon: FileCode,
    iconColor: 'text-[#F59E0B]',
    iconBg: 'bg-[rgba(245,158,11,0.1)]',
    badgeColor: 'bg-[rgba(245,158,11,0.12)] text-[#F59E0B]',
    canPreview: false,
    previewType: 'none',
  },
  // Archives
  zip: {
    Icon: FileArchive,
    iconColor: 'text-[var(--color-text-secondary)]',
    iconBg: 'bg-[var(--color-bg-secondary)]',
    badgeColor: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
    canPreview: false,
    previewType: 'none',
  },
  rar: {
    Icon: FileArchive,
    iconColor: 'text-[var(--color-text-secondary)]',
    iconBg: 'bg-[var(--color-bg-secondary)]',
    badgeColor: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
    canPreview: false,
    previewType: 'none',
  },
};

const DEFAULT_FILE_INFO: Omit<FileInfo, 'ext'> = {
  Icon: File,
  iconColor: 'text-[var(--color-brand-gold)]',
  iconBg: 'bg-[var(--color-brand-gold-muted)]',
  badgeColor: 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]',
  canPreview: false,
  previewType: 'none',
};

/**
 * Extracts the file extension from a path or filename.
 * Returns an empty string if none found.
 */
export function getExtension(pathOrName: string): string {
  const parts = pathOrName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Returns display info (icon, colors, preview capability) for a file
 * based on its storage_path or titulo.
 */
export function getFileInfo(pathOrName: string): FileInfo {
  const ext = getExtension(pathOrName);
  const info = EXT_MAP[ext] ?? DEFAULT_FILE_INFO;
  return { ext: ext.toUpperCase() || 'FILE', ...info };
}
