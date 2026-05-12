'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, GraduationCap, BarChart2, User, ShieldAlert,
  ShieldCheck, Trophy, Calendar, CheckCircle,
} from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Tooltip } from '@/components/common/Tooltip';
import { GraduadoEffect } from './GraduadoEffect';
import { TabInformacion } from './tabs/TabInformacion';

const TabEstadisticas = dynamic(
  () => import('./tabs/TabEstadisticas').then(m => m.TabEstadisticas),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><div className="size-6 animate-spin rounded-full border-2 border-[var(--color-brand-gold)] border-t-transparent" /></div> }
);

type Tab = 'info' | 'stats';

interface FichaAlumnoPageProps {
  alumnoId: string;
  role?: 'profesor' | 'admin' | 'alumno';
  backHref?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FichaData = Record<string, any>;

export function FichaAlumnoPage({ alumnoId, role = 'profesor', backHref }: FichaAlumnoPageProps) {
  const t = useTranslations('alumnos');
  const tf = useTranslations('ficha');
  const tc = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [graduadoModal, setGraduadoModal] = useState(false);
  const [quitarGraduadoModal, setQuitarGraduadoModal] = useState(false);
  const [fechaPrueba, setFechaPrueba] = useState(() => new Date().toISOString().slice(0, 10));
  const [intentosPrueba, setIntentosPrueba] = useState<string>('');

  // ── Fetch all data at once ──
  const { data, isLoading, error } = useQuery<FichaData>({
    queryKey: ['ficha-alumno', alumnoId],
    queryFn: async () => {
      const res = await fetch(`/api/alumnos/${alumnoId}/ficha`);
      if (!res.ok) throw new Error('Error cargando ficha');
      return res.json();
    },
    staleTime: 30_000,
  });

  const extra = data?.alumnos_extra;
  const pasoPrueba = extra?.paso_prueba === true;

  // ── Toggle paso prueba ──
  const togglePruebaMutation = useMutation({
    mutationFn: async (nuevoEstado: boolean) => {
      const body: Record<string, unknown> = { paso_prueba: nuevoEstado };
      if (nuevoEstado) {
        body.fecha_prueba = fechaPrueba;
        if (intentosPrueba) body.intentos_prueba = Number(intentosPrueba);
      } else {
        body.paso_prueba = false;
        body.fecha_prueba = null;
      }
      const res = await fetch(`/api/alumnos/${alumnoId}/ficha`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: (_, nuevoEstado) => {
      toast.success(nuevoEstado ? tf('graduado_marcado') : tf('graduado_quitado'));
      setGraduadoModal(false);
      setQuitarGraduadoModal(false);
      qc.invalidateQueries({ queryKey: ['ficha-alumno', alumnoId] });
    },
    onError: () => toast.error(tc('error')),
  });

  const back = backHref ?? (role === 'admin' ? '/admin/alumnos' : role === 'alumno' ? '/alumno' : '/profesor/mis-alumnos');

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-[var(--color-text-muted)]">{tf('error_cargar')}</p>
        <Button variant="ghost" onClick={() => router.push(back)}>
          <ArrowLeft className="mr-2 size-4" /> {tc('volver')}
        </Button>
      </div>
    );
  }

  const nombre = `${data.nombre} ${data.apellido}`;
  const getStatus = () => {
    if (!data.activo) return 'bloqueado' as const;
    if (pasoPrueba) return 'graduado' as const;
    return 'activo' as const;
  };

  return (
    // Outer wrapper — special gold gradient background when graduado
    <div
      className={`relative min-h-screen transition-all duration-700 ${pasoPrueba
          ? 'bg-gradient-to-br from-[#1a1400] via-[#1a1a1a] to-[#0f0c00]'
          : 'bg-[var(--color-bg)]'
        }`}
    >
      {/* Graduation effect — confetti & floating particles */}
      <GraduadoEffect active={pasoPrueba} />

      <div className="relative z-10 py-[var(--space-lg)]">
        {/* ── Back button (hidden for alumno self-profile) ── */}
        {role !== 'alumno' && (
          <button
            onClick={() => router.push(back)}
            className="mb-6 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="size-4" />
            {tc('volver')}
          </button>
        )}

        {/* ── Hero header ── */}
        <div
          className={`relative overflow-hidden rounded-[var(--radius-xl)] border p-6 mb-6 ${pasoPrueba
              ? 'border-[var(--color-brand-gold)]/40 bg-gradient-to-r from-[var(--color-brand-gold)]/10 to-[var(--color-brand-gold)]/5 shadow-[0_0_40px_rgba(201,153,63,0.15)]'
              : 'border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-md)]'
            }`}
        >
          {/* Decorative background glow when graduated */}
          {pasoPrueba && (
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #C9993F 0%, transparent 70%)' }}
            />
          )}

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* Avatar — larger on this page */}
            <div className={`relative shrink-0 ${pasoPrueba ? 'ring-2 ring-[var(--color-brand-gold)] ring-offset-2 ring-offset-transparent' : ''} rounded-full`}>
              <Avatar
                nombre={data.nombre}
                apellido={data.apellido}
                avatarUrl={data.avatar_url}
                size="xl"
              />
              {pasoPrueba && (
                <div className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-[var(--color-brand-gold)] shadow-lg">
                  <GraduationCap className="size-4 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start gap-3">
                <div>
                  <h1
                    className={`text-2xl font-bold sm:text-3xl ${pasoPrueba
                        ? 'bg-gradient-to-r from-[var(--color-brand-gold)] to-[var(--color-brand-gold-light)] bg-clip-text text-transparent'
                        : 'text-[var(--color-text-primary)]'
                      }`}
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {nombre}
                  </h1>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <StatusBadge status={getStatus()} />
                    {pasoPrueba && extra?.fecha_prueba && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-gold-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
                        <Calendar className="size-3" />
                        {new Date(extra.fecha_prueba).toLocaleDateString()}
                      </span>
                    )}
                    {pasoPrueba && extra?.intentos_prueba != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-gold-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
                        <Trophy className="size-3" />
                        {tf('intentos_count', { count: extra.intentos_prueba })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats mini-row */}
              {data.ficha_stats && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span className="text-[var(--color-text-muted)]">
                    <span className="font-semibold text-[var(--color-text-primary)]">{data.ficha_stats.total_clases}</span> {tf('stat_total_short')}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    <span className="font-semibold text-[var(--color-success)]">{data.ficha_stats.confirmadas}</span> {tf('stat_confirmadas')}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    <span className="font-semibold text-[var(--color-brand-gold)]">{data.ficha_stats.tasa_asistencia}%</span> {tf('stat_asistencia_short')}
                  </span>
                </div>
              )}
            </div>

            {/* Admin actions on the right */}
            {role === 'admin' && (
              <div className="flex shrink-0 gap-2">
                <Tooltip content={data.activo ? t('bloquear') : t('desbloquear')} position="left">
                  <button
                    className={`rounded-[var(--radius-md)] p-2 transition-colors ${data.activo
                        ? 'bg-red-50 text-[var(--color-error)] hover:bg-red-100 dark:bg-red-950/20'
                        : 'bg-green-50 text-[var(--color-success)] hover:bg-green-100 dark:bg-green-950/20'
                      }`}
                    onClick={() => {/* handled in admin page */ }}
                  >
                    {data.activo ? <ShieldAlert className="size-5" /> : <ShieldCheck className="size-5" />}
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        {/* ── Paso Prueba Card ── */}
        {role !== 'alumno' ? (
          <div
            className={`mb-6 rounded-[var(--radius-xl)] border p-5 transition-all duration-500 ${pasoPrueba
                ? 'border-[var(--color-brand-gold)]/50 bg-gradient-to-r from-[var(--color-brand-gold)]/10 via-[var(--color-brand-gold)]/5 to-transparent'
                : 'border-[var(--color-border)] bg-[var(--color-bg)]'
              }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${pasoPrueba ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-bg-secondary)]'
                    }`}
                >
                  {pasoPrueba
                    ? <GraduationCap className="size-5 text-white" />
                    : <GraduationCap className="size-5 text-[var(--color-text-muted)]" />
                  }
                </div>
                <div>
                  <p className={`font-semibold ${pasoPrueba ? 'text-[var(--color-brand-gold)]' : 'text-[var(--color-text-primary)]'}`}>
                    {pasoPrueba ? tf('graduado_titulo') : tf('no_graduado_titulo')}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {pasoPrueba ? tf('graduado_desc') : tf('no_graduado_desc')}
                  </p>
                </div>
              </div>
              {pasoPrueba ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuitarGraduadoModal(true)}
                  className="shrink-0 border border-[var(--color-border)] text-[var(--color-text-muted)]"
                >
                  {tf('quitar_graduado')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setGraduadoModal(true)}
                  className="shrink-0 bg-[var(--color-brand-gold)] text-white hover:bg-[var(--color-brand-gold)]/90"
                >
                  <CheckCircle className="mr-1.5 size-4" />
                  {tf('marcar_graduado')}
                </Button>
              )}
            </div>
          </div>
        ) : pasoPrueba ? (
          /* ── Banner estático de graduation para el alumno ── */
          <div className="mb-6 flex items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--color-brand-gold)]/50 bg-gradient-to-r from-[var(--color-brand-gold)]/10 via-[var(--color-brand-gold)]/5 to-transparent p-5">
            <div className="flex size-10 items-center justify-center rounded-full bg-[var(--color-brand-gold)]">
              <GraduationCap className="size-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-[var(--color-brand-gold)]">{tf('graduado_titulo')}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{tf('graduado_desc')}</p>
            </div>
          </div>
        ) : null}

        {/* ── Tabs ── */}
        <div className="mb-5 flex gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1">
          {([
            { key: 'info' as const, label: tf('tab_info'), icon: <User className="size-4" /> },
            { key: 'stats' as const, label: tf('tab_stats'), icon: <BarChart2 className="size-4" /> },
          ] as const).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 py-2.5 text-sm font-medium transition-all ${activeTab === key
                  ? pasoPrueba
                    ? 'bg-[var(--color-brand-gold)] text-white shadow-sm'
                    : 'bg-[var(--color-bg)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div
          className={`rounded-[var(--radius-xl)] border p-5 sm:p-6 ${pasoPrueba
              ? 'border-[var(--color-brand-gold)]/20 bg-[var(--color-bg)]/90 backdrop-blur-sm'
              : 'border-[var(--color-border)] bg-[var(--color-bg)]'
            }`}
        >
          {activeTab === 'info' && (
            <TabInformacion alumnoId={alumnoId} data={data as Parameters<typeof TabInformacion>[0]['data']} role={role} />
          )}
          {activeTab === 'stats' && (
            <TabEstadisticas data={{ historial_clases: data.historial_clases ?? [], pruebas: data.pruebas ?? [] }} />
          )}
        </div>
      </div>

      {/* ── Marcar graduado modal ── */}
      <Modal
        open={graduadoModal}
        onClose={() => setGraduadoModal(false)}
        title={`🎓 ${tf('marcar_graduado')}`}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setGraduadoModal(false)}>{tc('cancelar')}</Button>
            <Button
              onClick={() => togglePruebaMutation.mutate(true)}
              loading={togglePruebaMutation.isPending}
              className="bg-[var(--color-brand-gold)] text-white hover:bg-[var(--color-brand-gold)]/90"
            >
              {tf('confirmar_graduado')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {tf('marcar_graduado_desc', { nombre })}
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              {t('fecha_prueba')}
            </label>
            <input
              type="date"
              value={fechaPrueba}
              onChange={(e) => setFechaPrueba(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              {tf('intentos_prueba')} <span className="text-xs text-[var(--color-text-muted)]">(opcional)</span>
            </label>
            <input
              type="number"
              min="1"
              value={intentosPrueba}
              onChange={(e) => setIntentosPrueba(e.target.value)}
              placeholder="1"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            />
          </div>
        </div>
      </Modal>

      {/* ── Quitar graduado modal ── */}
      <Modal
        open={quitarGraduadoModal}
        onClose={() => setQuitarGraduadoModal(false)}
        title={tf('quitar_graduado_titulo')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setQuitarGraduadoModal(false)}>{tc('cancelar')}</Button>
            <Button
              variant="danger"
              onClick={() => togglePruebaMutation.mutate(false)}
              loading={togglePruebaMutation.isPending}
            >
              {tf('confirmar_quitar_graduado')}
            </Button>
          </div>
        }
      >
        <p className="py-2 text-sm text-[var(--color-text-secondary)]">
          {tf('quitar_graduado_desc', { nombre })}
        </p>
      </Modal>
    </div>
  );
}
