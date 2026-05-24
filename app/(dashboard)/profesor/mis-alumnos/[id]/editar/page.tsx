'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Copy, Check, Loader2, Key, AlertCircle, Link as LinkIcon, Trash2, User, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { m, AnimatePresence } from 'framer-motion';
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';

export default function ProfesorEditarAlumnoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const ta = useTranslations('alumnos');
  const tc = useTranslations('common');

  const [setupCode, setSetupCode] = useState<{ code?: string; password?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: alumno, isLoading, isError } = useQuery({
    queryKey: ['profesor-alumno', resolvedParams.id],
    queryFn: async () => {
      const res = await fetch(`/api/profesor/alumnos/${resolvedParams.id}`);
      if (!res.ok) throw new Error('No encontrado');
      return res.json();
    },
  });

  const isPending = !!alumno?.current_invitation;

  const generateLink = async () => {
    setGeneratingLink(true);
    try {
      const res = await fetch(`/api/profesor/alumnos/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_access', modo_creacion: 'link' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tc('error'));
      setSetupCode({ code: json.setup_code, password: json.password });
      queryClient.invalidateQueries({ queryKey: ['profesor-alumno', resolvedParams.id] });
      toast.success(tc('exito'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : tc('error'));
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (setupCode?.code) {
      const link = `${window.location.origin}/setup/${setupCode.code}`;
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success(tc('exito'));
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleDeleteAlumno = async () => {
    const res = await fetch(`/api/profesor/alumnos/${resolvedParams.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || tc('error'));
    queryClient.invalidateQueries({ queryKey: ['alumnos'] });
    toast.success(tc('exito'));
    router.push('/profesor/mis-alumnos');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-[var(--color-brand-gold)]" />
      </div>
    );
  }

  if (isError || !alumno) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="size-12 text-[var(--color-error)] mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{ta('error_cargar')}</h2>
        <Button onClick={() => router.push('/profesor/mis-alumnos')} className="mt-4">
          {tc('volver')}
        </Button>
      </div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title={ta('editar_titulo')}
        subtitle={`${alumno.nombre} ${alumno.apellido}`}
        actions={
          <Button variant="ghost" onClick={() => router.push('/profesor/mis-alumnos')}>
            <ArrowLeft className="size-4 mr-2" />
            {tc('volver')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-[var(--space-md)] lg:grid-cols-3">
        {/* Columna principal — Información del alumno */}
        <div className="lg:col-span-2 space-y-[var(--space-md)]">
          {/* Card: Información Personal */}
          <Card padding="none">
            <div className="px-6 pt-5 pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)]">
                  <User className="size-4 text-[var(--color-brand-gold)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {ta('info_alumno')}
                </h3>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--color-text-muted)]">{tc('nombre_completo')}</Label>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{alumno.nombre} {alumno.apellido}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--color-text-muted)]">{ta('email')}</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5 text-[var(--color-text-muted)]" />
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{alumno.email}</p>
                  </div>
                </div>
                {alumno.telefono && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--color-text-muted)]">{tc('telefono')}</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 text-[var(--color-text-muted)]" />
                      <p className="text-sm text-[var(--color-text-secondary)]">{alumno.telefono}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Card: Zona de Peligro */}
          <Card padding="none" className="border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10">
            <div className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-start gap-4">
                  <div className="bg-red-100 dark:bg-red-900/50 size-10 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                    <Trash2 className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-[var(--color-text-primary)]">{ta('eliminar_titulo')}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                      {ta('eliminar_desc', { nombre: alumno.nombre, apellido: alumno.apellido })}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                >
                  <Trash2 className="size-4" />
                  {tc('eliminar')}
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Columna lateral — Gestión de Acceso */}
        <div className="lg:col-span-1">
          <Card padding="none" className="lg:sticky lg:top-6 bg-[var(--color-bg-secondary)]">
            <div className="px-6 pt-5 pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)]">
                  <Key className="size-4 text-[var(--color-brand-gold)]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{ta('restablecer_titulo')}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {isPending ? ta('restablecer_desc_pendiente') : ta('restablecer_desc_activo')}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Current pending invitation */}
              {alumno.current_invitation && !setupCode && (
                <div className="bg-[var(--color-bg)] p-4 rounded-lg border border-[var(--color-border)]">
                  <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    {alumno.current_invitation.invitation_type === 'link' ? ta('enlace_pendiente') : ta('contrasena_pendiente')}
                  </h4>
                  {alumno.current_invitation.invitation_type === 'link' ? (
                    <div className="space-y-2">
                      <Input readOnly value={`${window.location.origin}/setup/${alumno.current_invitation.code}`} className="bg-[var(--color-bg-secondary)] text-xs" />
                      <Button onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/setup/${alumno.current_invitation.code}`);
                        toast.success(tc('exito'));
                      }} variant="secondary" size="sm" className="w-full">
                        <Copy className="size-4 mr-2" /> {ta('copiar_enlace')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input readOnly value={alumno.current_invitation.temp_password} className="bg-[var(--color-bg-secondary)] font-mono text-center tracking-wider" />
                      <Button onClick={() => {
                        navigator.clipboard.writeText(alumno.current_invitation.temp_password);
                        toast.success(tc('exito'));
                      }} variant="secondary" size="sm" className="w-full">
                        <Copy className="size-4 mr-2" /> {ta('copiar_contrasena')}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <AnimatePresence mode="wait">
                {setupCode ? (
                  <m.div
                    key="result"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 pt-2 border-t border-[var(--color-border)]"
                  >
                    <Label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      {ta('nuevo_acceso_generado')}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={setupCode.code ? `${window.location.origin}/setup/${setupCode.code}` : ''}
                        className="bg-[var(--color-bg)] border-[var(--color-border)] text-sm"
                      />
                      <Button onClick={handleCopyLink} variant="secondary" className="shrink-0">
                        {copiedLink ? <Check className="size-4 text-[var(--color-success)]" /> : <Copy className="size-4" />}
                      </Button>
                    </div>
                  </m.div>
                ) : (
                  <m.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-t border-[var(--color-border)] pt-4"
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={generateLink}
                      disabled={generatingLink}
                    >
                      {generatingLink ? <Loader2 className="size-4 mr-2 animate-spin" /> : <LinkIcon className="size-4 mr-2" />}
                      {isPending ? ta('regenerar_acceso') : ta('generar_enlace_cambio')}
                    </Button>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAlumno}
        entityName={`${alumno.nombre} ${alumno.apellido}`.trim()}
        entityType="alumno"
        description="Se eliminarán su historial, asistencias, notas y datos de acceso."
      />
    </m.div>
  );
}
