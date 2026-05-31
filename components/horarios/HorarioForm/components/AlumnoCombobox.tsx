'use client';

import { useState, useRef, useEffect } from 'react';
import type { Profile } from '@/lib/supabase/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlumnoComboboxProps {
  alumnos: Profile[];
  loading: boolean;
  selectedId: string;
  searchText: string;
  onSearchChange: (text: string) => void;
  onSelect: (id: string, displayName: string) => void;
  placeholder: string;
  emptyMessage: string;
  noResultsMessage: string;
  loadingMessage: string;
  inputClassName: string;
  filteredAlumnos: Profile[];
  /** When true, the input is disabled (e.g. no professor selected yet). */
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlumnoCombobox({
  alumnos,
  loading,
  selectedId,
  searchText,
  onSearchChange,
  onSelect,
  placeholder,
  emptyMessage,
  noResultsMessage,
  loadingMessage,
  inputClassName,
  filteredAlumnos,
  disabled = false,
}: AlumnoComboboxProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        value={searchText}
        onChange={(e) => {
          onSearchChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        placeholder={placeholder}
        className={`${inputClassName} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        autoComplete="off"
        disabled={disabled}
        aria-disabled={disabled}
      />
      {showDropdown && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] shadow-lg">
          {loading ? (
            <div className="flex items-center justify-center py-3">
              <div className="size-4 animate-spin rounded-full border-2 border-[var(--color-brand-gold)] border-t-transparent" />
              <span className="ml-2 text-sm text-[var(--color-text-muted)]">{loadingMessage}</span>
            </div>
          ) : filteredAlumnos.length > 0 ? (
            filteredAlumnos.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-bg-secondary)] ${
                  selectedId === a.id ? 'bg-[var(--color-bg-secondary)] font-medium' : ''
                }`}
                onClick={() => {
                  onSelect(a.id, `${a.nombre} ${a.apellido}`);
                  setShowDropdown(false);
                }}
              >
                <span className="text-[var(--color-text-primary)]">{a.nombre} {a.apellido}</span>
                <span className="ml-2 text-xs text-[var(--color-text-muted)]">{a.email}</span>
              </button>
            ))
          ) : alumnos.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--color-text-muted)]">
              {emptyMessage}
            </p>
          ) : (
            <p className="px-3 py-2 text-sm text-[var(--color-text-muted)]">
              {noResultsMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
