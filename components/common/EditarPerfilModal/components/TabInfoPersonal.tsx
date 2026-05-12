'use client';

import { Loader2, ClipboardCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import type { Profile, AlumnoExtra } from '@/lib/supabase/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type PerfilResponse = Profile & {
  alumno_extra: Pick<AlumnoExtra, 'universidad' | 'año_ingreso' | 'ha_dado_examen' | 'intentos_prueba'> | null;
};

export interface InfoFormData {
  nombre: string;
  apellidos: string;
  telefono: string;
  universidad: string;
  añoIngreso: string;
  haDadoExamen: boolean;
  intentosPrueba: string;
}

export interface TabInfoPersonalProps {
  perfilData: PerfilResponse | null;
  isAlumno: boolean;
  initialized: boolean;
  onSave: (data: InfoFormData) => Promise<void>;
  saving: boolean;
  processingImg: boolean;
  avatarSection: React.ReactNode;
  /** Form field state */
  nombre: string;
  setNombre: (v: string) => void;
  apellidos: string;
  setApellidos: (v: string) => void;
  telefono: string;
  setTelefono: (v: string) => void;
  universidad: string;
  setUniversidad: (v: string) => void;
  añoIngreso: string;
  setAñoIngreso: (v: string) => void;
  haDadoExamen: boolean;
  setHaDadoExamen: (v: boolean) => void;
  intentosPrueba: string;
  setIntentosPrueba: (v: string) => void;
}

// ─── Shared input class ───────────────────────────────────────────────────────

const inputCls = cn(
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
  'bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]',
  'placeholder:text-[var(--color-text-muted)]',
  'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]',
  'transition-colors',
);

// ─── Component ────────────────────────────────────────────────────────────────

export function TabInfoPersonal({
  perfilData: _perfilData,
  isAlumno,
  initialized,
  onSave,
  saving,
  processingImg,
  avatarSection,
  nombre,
  setNombre,
  apellidos,
  setApellidos,
  telefono,
  setTelefono,
  universidad,
  setUniversidad,
  añoIngreso,
  setAñoIngreso,
  haDadoExamen,
  setHaDadoExamen,
  intentosPrueba,
  setIntentosPrueba,
}: TabInfoPersonalProps) {
  const t = useTranslations('perfil');
  const tc = useTranslations('common');

  if (!initialized) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-[var(--color-brand-gold)]" />
      </div>
    );
  }

  return (
    <>
      {/* Avatar upload */}
      {avatarSection}

      {/* Nombre */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[var(--color-text-primary)]">
          {t('nombre')}
        </label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={t('nombre')}
          className={inputCls}
        />
      </div>

      {/* Apellidos (combined) */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[var(--color-text-primary)]">
          {t('apellidos')}
        </label>
        <input
          type="text"
          value={apellidos}
          onChange={(e) => setApellidos(e.target.value)}
          placeholder="García López"
          className={inputCls}
        />
        <p className="text-xs text-[var(--color-text-muted)]">{t('apellidos_hint')}</p>
      </div>

      {/* Teléfono */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[var(--color-text-primary)]">
          {t('telefono')}{' '}
          <span className="font-normal text-[var(--color-text-muted)]">{t('opcional')}</span>
        </label>
        <input
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="+56 9 1234 5678"
          className={inputCls}
        />
      </div>

      {/* Alumno-only fields */}
      {isAlumno && (
        <>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              {t('universidad')}{' '}
              <span className="font-normal text-[var(--color-text-muted)]">{t('opcional')}</span>
            </label>
            <input
              type="text"
              value={universidad}
              onChange={(e) => setUniversidad(e.target.value)}
              placeholder="Ej. Universidad de Chile"
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              {t('año_ingreso')}{' '}
              <span className="font-normal text-[var(--color-text-muted)]">{t('opcional')}</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={añoIngreso}
              onChange={(e) => setAñoIngreso(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Ej. 2023"
              maxLength={4}
              className={inputCls}
            />
          </div>

          {/* ── Examen de grado ── */}
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-3">
            {/* Checkbox row */}
            <button
              type="button"
              onClick={() => {
                const next = !haDadoExamen;
                setHaDadoExamen(next);
                if (!next) setIntentosPrueba('');
              }}
              className="flex w-full items-start gap-3 text-left"
              aria-checked={haDadoExamen}
              role="checkbox"
            >
              {/* Custom toggle box */}
              <div
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2 transition-all duration-200',
                  haDadoExamen
                    ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)]'
                    : 'border-[var(--color-border-strong)] bg-[var(--color-bg)]',
                )}
              >
                {haDadoExamen && (
                  <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)] leading-snug">
                  {t('ha_dado_examen')}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {t('ha_dado_examen_desc')}
                </p>
              </div>
            </button>

            {/* Animated count field */}
            <div
              className={cn(
                'grid transition-all duration-300 ease-in-out',
                haDadoExamen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <div className="pt-1 space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
                    <ClipboardCheck className="size-4 text-[var(--color-brand-gold)]" />
                    {t('veces_dado')}{' '}
                    <span className="font-normal text-[var(--color-text-muted)]">{t('opcional')}</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={intentosPrueba}
                    onChange={(e) => setIntentosPrueba(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    placeholder={t('veces_dado_placeholder')}
                    maxLength={2}
                    className={inputCls}
                    tabIndex={haDadoExamen ? 0 : -1}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <Button
        variant="primary"
        fullWidth
        loading={saving}
        onClick={() => onSave({
          nombre,
          apellidos,
          telefono,
          universidad,
          añoIngreso,
          haDadoExamen,
          intentosPrueba,
        })}
        disabled={saving || processingImg}
      >
        {saving ? tc('cargando') : t('guardar')}
      </Button>
    </>
  );
}
