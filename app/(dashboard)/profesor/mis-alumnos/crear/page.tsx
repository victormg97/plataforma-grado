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
import { ArrowLeft, Save, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function CrearAlumnoProfesorPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('crear_usuario.alumno');
  const tc = useTranslations('common');
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    universidad: '',
    año_ingreso: '',
    useAppEmail: false,
    modo_creacion: 'link' as 'link' | 'default',
  });

  const [createdData, setCreatedData] = useState<{
    email: string;
    password: string | null;
    setup_code: string | null;
  } | null>(null);
  
  const [copiedLink, setCopiedLink] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/profesor/alumnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tc('error'));
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['alumnos'] });
      toast.success(t('exito_titulo'));
      setCreatedData({
        email: data.email,
        password: data.password,
        setup_code: data.setup_code
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

  const handleCopyLink = () => {
    if (createdData?.setup_code) {
      const link = `${window.location.origin}/setup/${createdData.setup_code}`;
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success(tc('exito'));
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('titulo')}
        subtitle={t('subtitulo_profesor')}
        actions={
          <Button variant="ghost" onClick={() => router.push('/profesor/mis-alumnos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {tc('volver')}
          </Button>
        }
      />

      <AnimatePresence mode="wait">
        {createdData ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="p-8 text-center space-y-6 border-[var(--color-brand-gold)]/20 bg-amber-50/10">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-[var(--color-brand-gold)]" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('exito_titulo')}</h2>
              
              <div className="bg-[var(--color-bg)] p-6 rounded-xl border border-[var(--color-border)] shadow-sm text-left space-y-4">
                <div>
                  <Label className="text-[var(--color-text-muted)]">{t('correo_label')}</Label>
                  <p className="text-lg font-medium select-all text-[var(--color-text-primary)]">{createdData.email}</p>
                </div>
                
                {createdData.setup_code ? (
                  <div>
                    <Label className="text-[var(--color-text-muted)]">{t('enlace_label')}</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Input 
                        readOnly 
                        value={`${window.location.origin}/setup/${createdData.setup_code}`}
                        className="bg-[var(--color-bg-secondary)] flex-1 border-amber-200"
                      />
                      <Button onClick={handleCopyLink} variant="secondary" className="border-amber-200 hover:bg-amber-50">
                        {copiedLink ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-[var(--color-brand-gold)]" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label className="text-[var(--color-text-muted)]">{t('password_label')}</Label>
                    <p className="text-lg font-mono font-medium bg-[var(--color-bg-secondary)] p-3 rounded-lg select-all border text-center mt-2">
                      {createdData.password}
                    </p>
                  </div>
                )}
              </div>

              <Button 
                className="w-full mt-4 bg-[var(--color-brand-gold)] hover:opacity-90 text-white" 
                size="lg"
                onClick={() => router.push('/profesor/mis-alumnos')}
              >
                {t('boton_volver_lista')}
              </Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}>
            <Card className="max-w-2xl mx-auto shadow-sm">
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                
                {/* Datos Personales */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] border-b pb-2 border-[var(--color-border)]">
                    {t('datos_personales')}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nombre">{t('nombre')} <span className="text-red-500">*</span></Label>
                      <Input
                        id="nombre"
                        placeholder={t('nombre_placeholder')}
                        autoComplete="off"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apellido">{t('apellidos')} <span className="text-red-500">*</span></Label>
                      <Input
                        id="apellido"
                        placeholder={t('apellidos_placeholder')}
                        autoComplete="off"
                        value={formData.apellido}
                        onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Contacto & Acceso */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] border-b pb-2 border-[var(--color-border)]">
                    {t('contacto_acceso')}
                  </h3>
                  
                  <div className="space-y-4 bg-[var(--color-bg-secondary)]/50 p-4 rounded-lg border border-[var(--color-border)]">
                    <div className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        id="useAppEmail"
                        checked={formData.useAppEmail}
                        onChange={(e) => setFormData({ ...formData, useAppEmail: e.target.checked })}
                        className="rounded border-gray-300 text-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)] h-4 w-4"
                      />
                      <Label htmlFor="useAppEmail" className="font-medium cursor-pointer">
                        {t('generar_correo')}
                      </Label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="email">
                          {formData.useAppEmail ? t('correo') : t('correo_requerido')}
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder={formData.useAppEmail ? t('correo_placeholder_auto') : t('correo_placeholder')}
                          autoComplete="off"
                          disabled={formData.useAppEmail}
                          value={formData.useAppEmail ? '' : formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required={!formData.useAppEmail}
                          className={formData.useAppEmail ? 'opacity-50' : ''}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telefono">{t('telefono')}</Label>
                        <Input
                          id="telefono"
                          placeholder={t('telefono_placeholder')}
                          autoComplete="off"
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-[var(--color-border)] mt-4 space-y-3">
                      <Label className="text-sm font-medium text-[var(--color-text-secondary)]">
                        {t('modo_acceso')}
                      </Label>
                      <div className="flex bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg overflow-hidden shadow-sm">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, modo_creacion: 'link' })}
                          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                            formData.modo_creacion === 'link' 
                              ? 'bg-amber-50 text-[var(--color-brand-gold)] border-b-2 border-[var(--color-brand-gold)] dark:bg-amber-950/30' 
                              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                          }`}
                        >
                          {t('modo_enlace')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, modo_creacion: 'default' })}
                          className={`flex-1 py-2.5 text-sm font-medium transition-colors border-l border-[var(--color-border)] ${
                            formData.modo_creacion === 'default' 
                              ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-600 dark:bg-orange-950/30 dark:text-orange-300' 
                              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                          }`}
                        >
                          {t('modo_password')}
                        </button>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {formData.modo_creacion === 'link' 
                          ? t('modo_enlace_desc') 
                          : t('modo_password_desc', { year: new Date().getFullYear() })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detalles Académicos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] border-b pb-2 border-[var(--color-border)]">
                    {t('universidad')}
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="universidad">{t('universidad')}</Label>
                        <Input
                          id="universidad"
                          placeholder={t('universidad_placeholder')}
                          autoComplete="off"
                          value={formData.universidad}
                          onChange={(e) => setFormData({ ...formData, universidad: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="año_ingreso">{t('año_ingreso')}</Label>
                        <Input
                          id="año_ingreso"
                          type="number"
                          placeholder={t('año_ingreso_placeholder')}
                          autoComplete="off"
                          value={formData.año_ingreso}
                          onChange={(e) => setFormData({ ...formData, año_ingreso: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-[var(--color-border)] gap-3">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => router.push('/profesor/mis-alumnos')}
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
                      <><Loader2 className="w-4 h-4 animate-spin" /> {tc('cargando')}</>
                    ) : (
                      <><Save className="w-4 h-4" /> {t('crear_btn')}</>
                    )}
                  </button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
