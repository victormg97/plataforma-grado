'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Copy, Check, Loader2, Key, AlertCircle, Link as LinkIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';

export default function EditarProfesorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('crear_usuario.profesor');
  const tc = useTranslations('common');
  const tp = useTranslations('profesores');
  const ta = useTranslations('alumnos');

  const { data: profesor, isLoading: loadingData, isError } = useQuery({
    queryKey: ['admin-profesor', resolvedParams.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/profesores/${resolvedParams.id}`);
      if (!res.ok) throw new Error('Error al cargar datos');
      return res.json();
    }
  });

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    puede_crear_alumno: false
  });

  const [setupCode, setSetupCode] = useState<{ code: string | null; password: string | null } | null | 'email_sent'>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [regenModo, setRegenModo] = useState<'link' | 'default'>('link');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (profesor) {
      setFormData({
        nombre: profesor.nombre || '',
        apellido: profesor.apellido || '',
        telefono: profesor.telefono || '',
        puede_crear_alumno: profesor.puede_crear_alumno || false
      });
    }
  }, [profesor]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch(`/api/admin/profesores/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tc('error'));
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profesores'] });
      queryClient.invalidateQueries({ queryKey: ['admin-profesor'] });
      toast.success(tp('exito_actualizado'));
      router.push('/admin/profesores');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim() || !formData.apellido.trim()) {
      toast.error(t('error_nombre_requerido'));
      return;
    }
    updateMutation.mutate(formData);
  };

  const handleDeleteProfesor = async () => {
    const res = await fetch(`/api/admin/profesores/${resolvedParams.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || tc('error'));
    queryClient.invalidateQueries({ queryKey: ['admin-profesores'] });
    toast.success(tc('exito'));
    router.push('/admin/profesores');
  };

  const generateLink = async () => {
    try {
      setGeneratingLink(true);
      const res = await fetch(`/api/admin/profesores/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_access', modo_creacion: regenModo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tc('error'));
      
      setSetupCode({ code: json.setup_code, password: json.password });
      toast.success(tc('exito'));
    } catch (e: any) {
      toast.error(e.message || tc('error'));
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (setupCode && typeof setupCode !== 'string' && setupCode.code) {
      const link = `${window.location.origin}/setup/${setupCode.code}`;
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success(tc('exito'));
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-gold)]" />
      </div>
    );
  }

  if (isError || !profesor) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-[var(--color-error)] mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{tp('error_actualizar')}</h2>
        <Button onClick={() => router.push('/admin/profesores')} className="mt-4">
          {tc('volver')}
        </Button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <PageHeader
        title={tp('editar_titulo')}
        subtitle={`${profesor.nombre} ${profesor.apellido}`}
        actions={
          <Button variant="ghost" onClick={() => router.push('/admin/profesores')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {tc('volver')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start max-w-6xl mx-auto">
        <div className="lg:col-span-2">
          <Card className="shadow-sm">
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2">{t('datos_personales')}</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">{t('nombre')} <span className="text-red-500">*</span></Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellido">{t('apellidos')} <span className="text-red-500">*</span></Label>
                    <Input
                      id="apellido"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2">{t('contacto_acceso')}</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{ta('email')}</Label>
                    <Input value={profesor.email} disabled className="opacity-60" />
                    <p className="text-xs text-[var(--color-text-muted)]">{tp('correo_no_editable')}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">{t('telefono')} <span className="text-[var(--color-text-muted)] font-normal">{t('opcional')}</span></Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2">{t('puede_crear_alumnos')}</h3>
                <div className="flex items-start space-x-3 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900">
                  <input
                    type="checkbox"
                    id="puede_crear_alumno"
                    checked={formData.puede_crear_alumno}
                    onChange={(e) => setFormData({ ...formData, puede_crear_alumno: e.target.checked })}
                    className="mt-1 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="puede_crear_alumno" className="font-medium cursor-pointer text-indigo-900 dark:text-indigo-200">
                      {t('puede_crear_alumnos')}
                    </Label>
                    <p className="text-sm text-indigo-700/80 dark:text-indigo-300/80">
                      {t('puede_crear_alumnos_desc')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-[var(--color-border)] gap-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => router.push('/admin/profesores')}
                  disabled={updateMutation.isPending}
                >
                  {tc('cancelar')}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="min-w-[140px]">
                  {updateMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {tc('cargando')}</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> {tc('guardar_cambios')}</>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>        <div className="lg:col-span-1">
          <Card className="p-6 md:p-8 space-y-6 sticky top-6 shadow-sm border-orange-100 dark:border-orange-900/30 bg-orange-50/30 dark:bg-orange-950/10">
            <div className="bg-orange-100 dark:bg-orange-900/50 w-12 h-12 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-[var(--color-text-primary)]">{tp('restablecer_titulo')}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                {profesor?.estado_cuenta === 'Pendiente' ? tp('restablecer_desc_pendiente') : tp('restablecer_desc_activo')}
              </p>
            </div>

            {profesor.current_invitation && !setupCode && (
              <div className="space-y-4">
                <div className="bg-[var(--color-bg)] p-4 rounded-lg border border-orange-200 dark:border-orange-900/50">
                  <h4 className="text-sm font-medium text-orange-900 dark:text-orange-300 mb-2">
                    {profesor.current_invitation.invitation_type === 'link' ? tp('enlace_pendiente') : tp('contrasena_pendiente')}
                  </h4>
                  {profesor.current_invitation.invitation_type === 'link' ? (
                    <div className="space-y-2">
                       <Input readOnly value={`${window.location.origin}/setup/${profesor.current_invitation.code}`} className="bg-orange-50/50 dark:bg-orange-950/20 text-xs" />
                       <Button onClick={() => {
                         navigator.clipboard.writeText(`${window.location.origin}/setup/${profesor.current_invitation.code}`);
                         toast.success(tc('exito'));
                       }} variant="secondary" size="sm" className="w-full">
                         <Copy className="w-4 h-4 mr-2" /> {tp('copiar_enlace')}
                       </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                       <Input readOnly value={profesor.current_invitation.temp_password} className="bg-orange-50/50 dark:bg-orange-950/20 font-mono text-center tracking-wider" />
                       <Button onClick={() => {
                         navigator.clipboard.writeText(profesor.current_invitation.temp_password);
                         toast.success(tc('exito'));
                       }} variant="secondary" size="sm" className="w-full">
                         <Copy className="w-4 h-4 mr-2" /> {tp('copiar_contrasena')}
                       </Button>
                    </div>
                  )}
                  <p className="text-xs text-orange-600 mt-3 text-center">
                    {tp('expira_el', {
                      fecha: new Date(profesor.current_invitation.expires_at).toLocaleDateString(),
                      hora: new Date(profesor.current_invitation.expires_at).toLocaleTimeString()
                    })}
                  </p>
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {setupCode ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3 pt-2 border-t border-orange-100"
                >
                  <Label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{tp('nuevo_acceso_generado')}</Label>
                  {setupCode && typeof setupCode !== 'string' && setupCode.password ? (
                    <div className="flex items-center gap-2">
                      <Input 
                        readOnly 
                        value={setupCode.password}
                        className="bg-[var(--color-bg)] border-orange-200 dark:border-orange-900/50 text-sm font-mono text-center tracking-wider"
                      />
                      <Button onClick={() => {
                         navigator.clipboard.writeText(setupCode.password!);
                         setCopiedLink(true);
                         setTimeout(() => setCopiedLink(false), 2000);
                      }} variant="secondary" className="shrink-0">
                        {copiedLink ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input 
                        readOnly 
                        value={setupCode && typeof setupCode !== 'string' && setupCode.code ? `${window.location.origin}/setup/${setupCode.code}` : ''}
                        className="bg-[var(--color-bg)] border-orange-200 dark:border-orange-900/50 text-sm"
                      />
                      <Button onClick={handleCopyLink} variant="secondary" className="shrink-0">
                        {copiedLink ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pt-2"
                >
                  <div className="space-y-3 border-t border-orange-100 dark:border-orange-900/30 pt-4">
                    <Label className="text-sm font-medium text-[var(--color-text-secondary)]">
                      {profesor.current_invitation ? tp('regenerar_acceso') : tp('generar_enlace_cambio')}
                    </Label>
                    {/* For pending professors: show link/password toggle. For active: link only */}
                    {profesor?.estado_cuenta === 'Pendiente' && (
                      <div className="flex bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg overflow-hidden shadow-sm mb-3">
                        <button
                          type="button"
                          onClick={() => setRegenModo('link')}
                          className={`flex-1 py-2 text-xs font-medium transition-colors ${regenModo !== 'default' ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-600 dark:bg-amber-950/30 dark:text-amber-300' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'}`}
                        >
                          {tp('modo_enlace')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRegenModo('default')}
                          className={`flex-1 py-2 text-xs font-medium transition-colors border-l border-[var(--color-border)] ${regenModo === 'default' ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-600 dark:bg-orange-950/30 dark:text-orange-300' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'}`}
                        >
                          {tp('modo_contrasena')}
                        </button>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
                      onClick={generateLink}
                      disabled={generatingLink}
                    >
                      {generatingLink ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LinkIcon className="w-4 h-4 mr-2" />}
                      {profesor.current_invitation ? tp('regenerar_acceso') : tp('generar_enlace')}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      </div>

      {/* Delete Card */}
      <div>
        <Card className="p-6 shadow-sm border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div className="bg-red-100 dark:bg-red-900/50 w-10 h-10 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-[var(--color-text-primary)]">{tp('eliminar_titulo')}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                  {tp('eliminar_desc', { nombre: profesor?.nombre ?? '', apellido: profesor?.apellido ?? '' })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              {tc('eliminar')}
            </button>
          </div>
        </Card>
      </div>

      <ConfirmDeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteProfesor}
        entityName={`${profesor?.nombre ?? ''} ${profesor?.apellido ?? ''}`.trim()}
        entityType="profesor"
        description="No puedes eliminar profesores con alumnos asignados. Reasígnalos primero."
      />
    </motion.div>
  );
}
