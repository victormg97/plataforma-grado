'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Loader2, ChevronDown, User, Mail, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { m, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { CreatedUserSuccess } from '@/components/usuarios/CreatedUserSuccess';
import { CredentialsSection } from '@/components/usuarios/CredentialsSection';

export default function CrearAlumnoPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('crear_usuario.alumno');
  const tc = useTranslations('common');
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    apellido_materno: '',
    email: '',
    telefono: '',
    profesor_id: '',
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

  const { data: profesores = [] } = useQuery({
    queryKey: ['admin-profesores'],
    queryFn: async () => {
      const res = await fetch('/api/admin/profesores');
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    staleTime: 60_000,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeProfesores = profesores.filter((p: any) => p.activo);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/admin/alumnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tc('error'));
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
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
          <Button variant="ghost" onClick={() => router.push('/admin/alumnos')}>
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
            onBack={() => router.push('/admin/alumnos')}
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
                    <div className="p-6 space-y-6">
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

                      {/* Sección académica dentro de datos personales */}
                      <div className="border-t border-[var(--color-border)] pt-5">
                        <div className="flex items-center gap-2 mb-4">
                          <GraduationCap className="size-4 text-[var(--color-text-muted)]" />
                          <span className="text-sm font-medium text-[var(--color-text-secondary)]">{t('universidad')}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="universidad">{t('universidad')}</Label>
                            <Input
                              id="universidad"
                              placeholder={t('universidad_placeholder')}
                              autoComplete="off"
                              value={formData.universidad}
                              onChange={(e) => setFormData(prev => ({ ...prev, universidad: e.target.value }))}
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
                              onChange={(e) => setFormData(prev => ({ ...prev, año_ingreso: e.target.value }))}
                            />
                          </div>
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
                      />
                    </div>
                  </Card>
                </div>

                {/* Columna lateral — Profesor + Académicos */}
                <div className="lg:col-span-1 space-y-[var(--space-md)]">
                  {/* Card: Profesor Asignado */}
                  <Card padding="none" className="lg:sticky lg:top-6">
                    <div className="px-6 pt-5 pb-3 border-b border-[var(--color-border)]">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)]">
                          <GraduationCap className="size-4 text-[var(--color-brand-gold)]" />
                        </div>
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                          {t('profesor_asignado')}
                        </h3>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="space-y-2">
                        <Label>{t('seleccionar_profesor')}</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="w-full flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm">
                            <span className="truncate">
                              {(() => {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const p = activeProfesores.find((p: any) => p.id === formData.profesor_id);
                                return p ? `${p.nombre} ${p.apellido}` : tc('sin_datos');
                              })()}
                            </span>
                            <ChevronDown className="size-4 shrink-0 text-[var(--color-text-muted)]" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-full max-h-60 overflow-y-auto">
                            <DropdownMenuItem onClick={() => setFormData(prev => ({ ...prev, profesor_id: '' }))}>
                              {tc('sin_datos')}
                            </DropdownMenuItem>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {activeProfesores.map((p: any) => (
                              <DropdownMenuItem key={p.id} onClick={() => setFormData(prev => ({ ...prev, profesor_id: p.id }))}>
                                {p.nombre} {p.apellido}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                        onClick={() => router.push('/admin/alumnos')}
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
