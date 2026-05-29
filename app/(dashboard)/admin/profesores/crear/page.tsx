'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Loader2, User, Mail, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { m, AnimatePresence } from 'framer-motion';
import { CreatedUserSuccess } from '@/components/usuarios/CreatedUserSuccess';
import { CredentialsSection } from '@/components/usuarios/CredentialsSection';
import { useTenant } from '@/config/client';

export default function CrearProfesorPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('crear_usuario.profesor');
  const tc = useTranslations('common');
  const tenant = useTenant();
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    apellido_materno: '',
    email: '',
    telefono: '',
    useAppEmail: false,
    modo_creacion: 'link' as 'link' | 'default',
    puede_crear_alumno: true,
  });

  const [createdData, setCreatedData] = useState<{
    email: string;
    password: string | null;
    setup_code: string | null;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/admin/profesores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tc('error'));
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-profesores'] });
      toast.success(t('exito_titulo'));
      setCreatedData({
        email: data.email,
        password: data.password,
        setup_code: data.setup_code,
      });
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
    if (!formData.useAppEmail && !formData.email.trim()) {
      toast.error(t('error_correo_requerido'));
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('titulo')}
        subtitle={t('subtitulo')}
        actions={
          <Button variant="ghost" onClick={() => router.push('/admin/profesores')}>
            <ArrowLeft className="size-4 mr-2" />
            {tc('volver')}
          </Button>
        }
      />

      <AnimatePresence mode="wait">
        {createdData ? (
          <CreatedUserSuccess
            email={createdData.email}
            password={createdData.password}
            setupCode={createdData.setup_code}
            onBack={() => router.push('/admin/profesores')}
          />
        ) : (
          <m.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-[var(--space-md)] lg:grid-cols-3">
                {/* Columna principal — Datos personales + Contacto */}
                <div className="lg:col-span-2 space-y-[var(--space-md)]">
                  {/* Card: Datos Personales */}
                  <Card padding="none">
                    <div className="px-6 pt-5 pb-3 border-b border-[var(--color-border)]">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)]">
                          <User className="size-4 text-[var(--color-brand-gold)]" />
                        </div>
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                          {t('datos_personales')}
                        </h3>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="nombre">{t('nombre')} <span className="text-red-500">*</span></Label>
                        <Input
                          id="nombre"
                          placeholder={t('nombre_placeholder')}
                          autoComplete="off"
                          value={formData.nombre}
                          onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="apellido">{t('apellido1')} <span className="text-red-500">*</span></Label>
                          <Input
                            id="apellido"
                            placeholder={t('apellido1_placeholder')}
                            autoComplete="off"
                            value={formData.apellido}
                            onChange={(e) => setFormData(prev => ({ ...prev, apellido: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="apellido_materno">{t('apellido2')} <span className="text-[var(--color-text-muted)] text-sm font-normal">{t('opcional')}</span></Label>
                          <Input
                            id="apellido_materno"
                            placeholder={t('apellido2_placeholder')}
                            autoComplete="off"
                            value={formData.apellido_materno}
                            onChange={(e) => setFormData(prev => ({ ...prev, apellido_materno: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Card: Contacto y Acceso */}
                  <Card padding="none">
                    <div className="px-6 pt-5 pb-3 border-b border-[var(--color-border)]">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)]">
                          <Mail className="size-4 text-[var(--color-brand-gold)]" />
                        </div>
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                          {t('contacto_acceso')}
                        </h3>
                      </div>
                    </div>
                    <div className="p-6">
                      <CredentialsSection
                        hideTitle
                        useAppEmail={formData.useAppEmail}
                        onUseAppEmailChange={(v) => setFormData(prev => ({ ...prev, useAppEmail: v }))}
                        email={formData.email}
                        onEmailChange={(v) => setFormData(prev => ({ ...prev, email: v }))}
                        telefono={formData.telefono}
                        onTelefonoChange={(v) => setFormData(prev => ({ ...prev, telefono: v }))}
                        modoCreacion={formData.modo_creacion}
                        onModoCreacionChange={(v) => setFormData(prev => ({ ...prev, modo_creacion: v }))}
                        emailDomain={tenant.emailDomain}
                      />
                    </div>
                  </Card>
                </div>

                {/* Columna lateral — Permisos */}
                <div className="lg:col-span-1">
                  <Card padding="none" className="lg:sticky lg:top-6">
                    <div className="px-6 pt-5 pb-3 border-b border-[var(--color-border)]">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)]">
                          <Shield className="size-4 text-[var(--color-brand-gold)]" />
                        </div>
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                          {t('puede_crear_alumnos')}
                        </h3>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex items-start space-x-3 p-4 bg-[var(--color-brand-gold-muted)] rounded-lg border border-[var(--color-brand-gold)]/20">
                        <input
                          type="checkbox"
                          id="puede_crear_alumno"
                          checked={formData.puede_crear_alumno}
                          onChange={(e) => setFormData(prev => ({ ...prev, puede_crear_alumno: e.target.checked }))}
                          className="mt-1 rounded border-gray-300 text-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)] size-4"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="puede_crear_alumno" className="font-medium cursor-pointer">
                            {t('puede_crear_alumnos')}
                          </Label>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            {t('puede_crear_alumnos_desc')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Barra de acciones — full width */}
                <div className="lg:col-span-3">
                  <Card padding="none">
                    <div className="flex items-center justify-end gap-3 px-6 py-4">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.push('/admin/profesores')}
                        disabled={mutation.isPending}
                      >
                        {tc('cancelar')}
                      </Button>
                      <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="min-w-[140px] flex items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {mutation.isPending ? (
                          <><Loader2 className="size-4 animate-spin" /> {tc('cargando')}</>
                        ) : (
                          <><Save className="size-4" /> {t('crear_btn')}</>
                        )}
                      </button>
                    </div>
                  </Card>
                </div>
              </div>
            </form>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
