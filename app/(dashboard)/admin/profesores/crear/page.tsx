'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { m, AnimatePresence } from 'framer-motion';
import { CreatedUserSuccess } from '@/components/usuarios/CreatedUserSuccess';
import { CredentialsSection } from '@/components/usuarios/CredentialsSection';
import { PersonalInfoFields } from '@/components/usuarios/PersonalInfoFields';

export default function CrearProfesorPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('crear_usuario.profesor');
  const tc = useTranslations('common');
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    datos_adicionales: '',
    useAppEmail: false,
    modo_creacion: 'link' as 'link' | 'default',
    puede_crear_alumno: false,
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
            <Card className="max-w-2xl mx-auto shadow-sm">
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                <PersonalInfoFields
                  nombre={formData.nombre}
                  onNombreChange={(v) => setFormData(prev => ({ ...prev, nombre: v }))}
                  apellido={formData.apellido}
                  onApellidoChange={(v) => setFormData(prev => ({ ...prev, apellido: v }))}
                />

                <CredentialsSection
                  useAppEmail={formData.useAppEmail}
                  onUseAppEmailChange={(v) => setFormData(prev => ({ ...prev, useAppEmail: v }))}
                  email={formData.email}
                  onEmailChange={(v) => setFormData(prev => ({ ...prev, email: v }))}
                  telefono={formData.telefono}
                  onTelefonoChange={(v) => setFormData(prev => ({ ...prev, telefono: v }))}
                  modoCreacion={formData.modo_creacion}
                  onModoCreacionChange={(v) => setFormData(prev => ({ ...prev, modo_creacion: v }))}
                />

                {/* Permisos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2">
                    {t('puede_crear_alumnos')}
                  </h3>
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

                {/* Datos Adicionales */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2">
                    {t('datos_adicionales')} <span className="text-[var(--color-text-muted)] text-sm font-normal">{t('opcional')}</span>
                  </h3>
                  <textarea
                    id="datos_adicionales"
                    className="flex w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)] min-h-[100px]"
                    placeholder={t('datos_adicionales_placeholder')}
                    value={formData.datos_adicionales}
                    onChange={(e) => setFormData(prev => ({ ...prev, datos_adicionales: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end pt-6 border-t border-[var(--color-border)] gap-3">
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
              </form>
            </Card>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
