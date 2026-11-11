'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ListaProfesores } from '@/components/profesores/ListaProfesores';
import type { ProfesorCardData } from '@/components/profesores/ProfesorCard';
import { useConteosStaff } from '@/components/cedularios/seguimiento/staff/useConteosStaff';
import { useSegUrl } from '@/components/cedularios/seguimiento/url/useSegUrl';

type Profesor = {
  id: string;
  nombre: string;
  apellido: string;
  apellido_materno?: string | null;
  email: string;
  telefono: string | null;
  avatar_url: string | null;
  activo: boolean;
  rol: string;
  alumnos_count: number;
  estado_cuenta?: 'Pendiente' | 'Activo';
};

export default function ProfesoresPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tp = useTranslations('profesores');
  const tc = useTranslations('common');
  const te = useTranslations('enlaces');
  const { data: profesores = [], isLoading: loading } = useQuery<Profesor[]>({
    queryKey: ['admin-profesores'],
    queryFn: async () => {
      const res = await fetch('/api/admin/profesores');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
  });

  const { data: conteosCedularios } = useConteosStaff();
  const { abrir: abrirSeg } = useSegUrl();
  const totalCedularios = (id: string) => conteosCedularios?.[id] ?? 0;
  const etiquetaCedulario = (id: string) =>
    totalCedularios(id) > 0
      ? tp('revisar_cedularios', { count: totalCedularios(id) })
      : tp('asignar_cedulario');
  const abrirCedulario = (id: string) =>
    abrirSeg({ modal: totalCedularios(id) > 0 ? 'revision' : 'asignar', alumno: id });

  const [confirmAction, setConfirmAction] = useState<{ id: string; nombre: string; activo: boolean } | null>(null);

  const handleToggle = async () => {
    if (!confirmAction) return;
    try {
      const res = await fetch(`/api/admin/profesores/${confirmAction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !confirmAction.activo }),
      });
      if (!res.ok) throw new Error();
      toast.success(confirmAction.activo ? tp('exito_deshabilitado') : tp('exito_habilitado'));
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ['admin-profesores'] });
    } catch {
      toast.error(tp('error_actualizar'));
    }
  };

  const nombreCompleto = (p: ProfesorCardData) =>
    [p.nombre, p.apellido, p.apellido_materno].filter(Boolean).join(' ');


  return (
    <div>
      <PageHeader
        title={tp('titulo')}
        subtitle={tp('subtitulo')}
        actions={
          <>
            <Button variant="secondary" onClick={() => router.push('/enlaces-invitacion?from=/admin/profesores')}>
              <Link2 className="mr-1.5 size-4" />
              {te('boton_enlace_invitacion')}
            </Button>
            <Button onClick={() => router.push('/admin/profesores/crear')}>
              <Plus className="mr-1.5 size-4" />
              {tp('nuevo_profesor')}
            </Button>
          </>
        }
      />

      <div className="mt-[var(--space-lg)]">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
          </div>
        ) : profesores.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-[var(--color-text-muted)]">{tp('sin_profesores')}</p>
          </Card>
        ) : (
          <ListaProfesores
            profesores={profesores}
            etiquetaCedulario={etiquetaCedulario}
            onEditar={(p) => router.push(`/admin/profesores/${p.id}/editar`)}
            onToggleActivo={(p) => setConfirmAction({ id: p.id, nombre: nombreCompleto(p), activo: p.activo })}
            onCedulario={(p) => abrirCedulario(p.id)}
          />
        )}
      </div>

      {/* Confirm enable/disable */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.activo ? tp('deshabilitar_titulo') : tp('habilitar_titulo')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>{tc('cancelar')}</Button>
            <Button variant={confirmAction?.activo ? 'danger' : 'primary'} onClick={handleToggle}>
              {confirmAction?.activo ? tp('deshabilitar') : tp('habilitar')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--color-text-primary)]">
          {confirmAction?.activo
            ? tp('confirm_deshabilitar', { nombre: confirmAction.nombre })
            : tp('confirm_habilitar', { nombre: confirmAction?.nombre ?? '' })}
        </p>
      </Modal>
    </div>
  );
}
