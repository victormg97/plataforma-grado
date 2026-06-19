'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useUserStore } from '@/stores/useUserStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save, Tag, BookOpen, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { LandingPlanesConfig } from '@/lib/supabase/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  oferta_activa: boolean;
  oferta_texto: string;
  oferta_mes_automatico: boolean;
  plan1_nombre: string;
  plan1_detalle: string;
  plan1_precio: number;
  plan1_precio_antes: number | null;
  plan2_nombre: string;
  plan2_detalle: string;
  plan2_precio: number;
  plan2_precio_antes: number | null;
  tutoria1_nombre: string;
  tutoria1_detalle: string;
  tutoria1_precio: number;
  tutoria2_nombre: string;
  tutoria2_detalle: string;
  tutoria2_precio: number;
  lector_precio: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function configToForm(config: LandingPlanesConfig): FormData {
  return {
    oferta_activa: config.oferta_activa,
    oferta_texto: config.oferta_texto ?? '',
    oferta_mes_automatico: config.oferta_mes_automatico,
    plan1_nombre: config.plan1_nombre,
    plan1_detalle: config.plan1_detalle,
    plan1_precio: config.plan1_precio,
    plan1_precio_antes: config.plan1_precio_antes,
    plan2_nombre: config.plan2_nombre,
    plan2_detalle: config.plan2_detalle,
    plan2_precio: config.plan2_precio,
    plan2_precio_antes: config.plan2_precio_antes,
    tutoria1_nombre: config.tutoria1_nombre,
    tutoria1_detalle: config.tutoria1_detalle,
    tutoria1_precio: config.tutoria1_precio,
    tutoria2_nombre: config.tutoria2_nombre,
    tutoria2_detalle: config.tutoria2_detalle,
    tutoria2_precio: config.tutoria2_precio,
    lector_precio: config.lector_precio,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)]">
        <Icon className="size-4 text-[var(--color-brand-gold)]" />
      </div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {title}
      </h3>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium text-[var(--color-text-secondary)]">
      {children}
    </label>
  );
}

function PriceInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]">$</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === '' ? null : parseInt(val, 10));
        }}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]',
          'py-2.5 pl-7 pr-3 text-sm text-[var(--color-text-primary)]',
          'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]',
          'transition-colors'
        )}
      />
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]',
        'px-3 py-2.5 text-sm text-[var(--color-text-primary)]',
        'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]',
        'transition-colors'
      )}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
          checked ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border)]'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-5.5 mt-0.5 ml-0.5' : 'translate-x-0.5 mt-0.5'
          )}
        />
      </button>
      <div className="min-w-0">
        <span className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-gold)] transition-colors">
          {label}
        </span>
        {description && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  title,
  nombre,
  onNombreChange,
  detalle,
  onDetalleChange,
  precio,
  onPrecioChange,
  precioAntes,
  onPrecioAntesChange,
  t,
}: {
  title: string;
  nombre: string;
  onNombreChange: (v: string) => void;
  detalle: string;
  onDetalleChange: (v: string) => void;
  precio: number;
  onPrecioChange: (v: number | null) => void;
  precioAntes?: number | null;
  onPrecioAntesChange?: (v: number | null) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 space-y-4">
      <h4 className="text-sm font-bold text-[var(--color-brand-gold)]">{title}</h4>

      <div className="space-y-3">
        <div>
          <FieldLabel>{t('nombre')}</FieldLabel>
          <TextInput value={nombre} onChange={onNombreChange} />
        </div>
        <div>
          <FieldLabel>{t('detalle')}</FieldLabel>
          <TextInput value={detalle} onChange={onDetalleChange} />
        </div>
        <div>
          <FieldLabel>{t('precio')}</FieldLabel>
          <PriceInput value={precio} onChange={(v) => onPrecioChange(v)} />
        </div>
        {onPrecioAntesChange !== undefined && (
          <div>
            <FieldLabel>{t('precio_antes')}</FieldLabel>
            <PriceInput
              value={precioAntes ?? null}
              onChange={onPrecioAntesChange}
              placeholder={t('precio_antes_placeholder')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

async function fetchAdminConfig(): Promise<LandingPlanesConfig> {
  const res = await fetch('/api/landing/planes/admin');
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

async function saveConfig(data: FormData): Promise<LandingPlanesConfig> {
  const res = await fetch('/api/landing/planes/admin', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save');
  return res.json();
}

async function revalidateLanding(): Promise<void> {
  await fetch('/api/landing/planes/revalidate', { method: 'POST' });
}

export default function PlanesConfigPage() {
  const { user } = useUserStore();
  const router = useRouter();
  const t = useTranslations('planesConfig');
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormData | null>(null);

  // Guard: solo admins
  useEffect(() => {
    if (user && user.rol !== 'admin') {
      router.replace('/perfil');
    }
  }, [user, router]);

  // Fetch config
  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-planes-config'],
    queryFn: fetchAdminConfig,
    staleTime: 60_000,
    enabled: !!user && user.rol === 'admin',
  });

  // Initialize form from fetched config
  const effectiveForm = form ?? (config ? configToForm(config) : null);

  // Save mutation
  const mutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: async () => {
      toast.success(t('guardado_ok'));
      // Invalidate admin query and landing cache
      queryClient.invalidateQueries({ queryKey: ['admin-planes-config'] });
      queryClient.invalidateQueries({ queryKey: ['landing-planes-config'] });
      // Trigger revalidation of the landing page on the server
      await revalidateLanding();
    },
    onError: () => {
      toast.error(t('guardado_error'));
    },
  });

  if (!user || user.rol !== 'admin') return null;

  if (isLoading || !effectiveForm) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-[var(--color-brand-gold)]" />
      </div>
    );
  }

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => {
      const base = prev ?? (config ? configToForm(config) : null);
      return base ? { ...base, [key]: value } : null;
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Link
          href="/pagina"
          className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-brand-gold)] transition-colors"
        >
          <ArrowLeft className="size-4 text-[var(--color-text-muted)]" />
        </Link>
        <div>
          <h1
            className="text-2xl font-bold text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('titulo')}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed max-w-lg">
            {t('subtitulo')}
          </p>
        </div>
      </div>

      {/* ── Oferta / Promoción ── */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 space-y-5">
        <SectionTitle icon={Tag} title={t('seccion_oferta')} />

        <Toggle
          checked={effectiveForm.oferta_activa}
          onChange={(v) => update('oferta_activa', v)}
          label={t('oferta_activa')}
          description={t('oferta_activa_desc')}
        />

        {effectiveForm.oferta_activa && (
          <div className="pl-14 space-y-4">
            <Toggle
              checked={effectiveForm.oferta_mes_automatico}
              onChange={(v) => update('oferta_mes_automatico', v)}
              label={t('oferta_mes_automatico')}
              description={t('oferta_mes_automatico_desc')}
            />

            {!effectiveForm.oferta_mes_automatico && (
              <div>
                <FieldLabel>{t('oferta_texto')}</FieldLabel>
                <TextInput
                  value={effectiveForm.oferta_texto}
                  onChange={(v) => update('oferta_texto', v)}
                  placeholder={t('oferta_texto_placeholder')}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Planes de Interrogación ── */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 space-y-5">
        <SectionTitle icon={BookOpen} title={t('seccion_interrogaciones')} />

        <div className="grid gap-4 sm:grid-cols-2">
          <PlanCard
            title="Plan 1"
            nombre={effectiveForm.plan1_nombre}
            onNombreChange={(v) => update('plan1_nombre', v)}
            detalle={effectiveForm.plan1_detalle}
            onDetalleChange={(v) => update('plan1_detalle', v)}
            precio={effectiveForm.plan1_precio}
            onPrecioChange={(v) => update('plan1_precio', v ?? 0)}
            precioAntes={effectiveForm.plan1_precio_antes}
            onPrecioAntesChange={(v) => update('plan1_precio_antes', v)}
            t={t}
          />
          <PlanCard
            title="Plan 2"
            nombre={effectiveForm.plan2_nombre}
            onNombreChange={(v) => update('plan2_nombre', v)}
            detalle={effectiveForm.plan2_detalle}
            onDetalleChange={(v) => update('plan2_detalle', v)}
            precio={effectiveForm.plan2_precio}
            onPrecioChange={(v) => update('plan2_precio', v ?? 0)}
            precioAntes={effectiveForm.plan2_precio_antes}
            onPrecioAntesChange={(v) => update('plan2_precio_antes', v)}
            t={t}
          />
        </div>
      </section>

      {/* ── Tutorías Online ── */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 space-y-5">
        <SectionTitle icon={BookOpen} title={t('seccion_tutorias')} />

        <div className="grid gap-4 sm:grid-cols-2">
          <PlanCard
            title="Tutoría 1"
            nombre={effectiveForm.tutoria1_nombre}
            onNombreChange={(v) => update('tutoria1_nombre', v)}
            detalle={effectiveForm.tutoria1_detalle}
            onDetalleChange={(v) => update('tutoria1_detalle', v)}
            precio={effectiveForm.tutoria1_precio}
            onPrecioChange={(v) => update('tutoria1_precio', v ?? 0)}
            t={t}
          />
          <PlanCard
            title="Tutoría 2"
            nombre={effectiveForm.tutoria2_nombre}
            onNombreChange={(v) => update('tutoria2_nombre', v)}
            detalle={effectiveForm.tutoria2_detalle}
            onDetalleChange={(v) => update('tutoria2_detalle', v)}
            precio={effectiveForm.tutoria2_precio}
            onPrecioChange={(v) => update('tutoria2_precio', v ?? 0)}
            t={t}
          />
        </div>
      </section>

      {/* ── Programa Lector ── */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 space-y-5">
        <SectionTitle icon={GraduationCap} title={t('seccion_lector')} />

        <div className="max-w-xs">
          <FieldLabel>{t('precio')}</FieldLabel>
          <PriceInput
            value={effectiveForm.lector_precio}
            onChange={(v) => update('lector_precio', v ?? 0)}
          />
        </div>
      </section>

      {/* ── Save button ── */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          type="button"
          onClick={() => effectiveForm && mutation.mutate(effectiveForm)}
          disabled={mutation.isPending}
          className={cn(
            'flex items-center gap-2 rounded-[var(--radius-lg)] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all',
            'bg-[var(--color-brand-gold)] hover:opacity-90',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {mutation.isPending ? t('guardando') : t('guardar')}
        </button>
      </div>
    </div>
  );
}
