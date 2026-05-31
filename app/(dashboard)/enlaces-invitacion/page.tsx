'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';
import { useUser } from '@/lib/hooks/useUser';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import { agruparPorEstado } from '@/lib/enlaces/agrupar';
import { filtrarEnlaces, type FiltroState } from '@/lib/enlaces/filtrar';
import { destinoRetorno } from '@/lib/enlaces/navegacion';
import type { EnlaceListItem } from '@/lib/enlaces/types';
import { ModalCrearEnlace } from '@/components/enlaces/ModalCrearEnlace';
import { ModalEditarEnlace } from '@/components/enlaces/ModalEditarEnlace';
import { FiltrosEnlaces } from '@/components/enlaces/FiltrosEnlaces';
import { GrupoEstado } from '@/components/enlaces/GrupoEstado';

export default function EnlacesInvitacionPage() {
  const t = useTranslations('enlaces');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const from = searchParams.get('from');

  const esAdmin = user?.rol === 'admin';
  const esProfesorHabilitado = user?.rol === 'profesor' && user?.puede_crear_alumno === true;
  const autorizado = esAdmin || esProfesorHabilitado;

  // ── Control de acceso por ruta directa (Req 1.7) ──
  useEffect(() => {
    if (user && !autorizado) {
      router.replace(getRolRedirectPath(user.rol));
    }
  }, [user, autorizado, router]);

  const [filtro, setFiltro] = useState<FiltroState>({ creador: null, tipo: null });
  const [crearOpen, setCrearOpen] = useState(false);
  const [editar, setEditar] = useState<EnlaceListItem | null>(null);
  const [eliminar, setEliminar] = useState<EnlaceListItem | null>(null);

  const { data: enlaces = [], isLoading } = useQuery<EnlaceListItem[]>({
    queryKey: ['enlaces-invitacion'],
    queryFn: async () => {
      const res = await fetch('/api/enlaces-invitacion');
      if (!res.ok) throw new Error('error');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: autorizado,
    staleTime: 30_000,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['enlaces-invitacion'] });

  const filtrados = useMemo(() => filtrarEnlaces(enlaces, filtro), [enlaces, filtro]);
  const grupos = useMemo(() => agruparPorEstado(filtrados), [filtrados]);

  const handleToggleEstado = async (
    enlace: EnlaceListItem,
    accion: 'habilitar' | 'deshabilitar',
  ) => {
    try {
      const res = await fetch(`/api/enlaces-invitacion/${enlace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'ENLACE_USADO') {
          toast.error(t('error_enlace_usado'));
        } else {
          toast.error(t('error_accion'));
        }
        return;
      }
      toast.success(accion === 'deshabilitar' ? t('exito_deshabilitar') : t('exito_habilitar'));
      refetch();
    } catch {
      toast.error(t('error_accion'));
    }
  };

  const handleEliminar = async () => {
    if (!eliminar) return;
    try {
      const res = await fetch(`/api/enlaces-invitacion/${eliminar.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success(t('exito_eliminar'));
      setEliminar(null);
      refetch();
    } catch {
      toast.error(t('error_accion'));
    }
  };

  const handleVolver = () => {
    router.push(destinoRetorno(user?.rol ?? 'admin', from));
  };

  if (!user || !autorizado) {
    return null;
  }

  return (
    <div>
      <button
        onClick={handleVolver}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="size-4" />
        {tc('volver')}
      </button>

      <PageHeader
        title={t('titulo')}
        subtitle={t('subtitulo')}
        actions={
          <Button onClick={() => setCrearOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            {t('crear_enlace')}
          </Button>
        }
      />

      {enlaces.length > 0 && (
        <div className="mt-[var(--space-lg)]">
          <FiltrosEnlaces enlaces={enlaces} filtro={filtro} onChange={setFiltro} />
        </div>
      )}

      <div className="mt-[var(--space-lg)] space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
          </div>
        ) : enlaces.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-[var(--color-text-muted)]">{t('sin_enlaces')}</p>
          </Card>
        ) : grupos.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-[var(--color-text-muted)]">{t('sin_coincidencias')}</p>
          </Card>
        ) : (
          grupos.map((g) => (
            <GrupoEstado
              key={g.estado}
              estado={g.estado}
              items={g.items}
              rol={user.rol}
              onEditar={setEditar}
              onToggleEstado={handleToggleEstado}
              onEliminar={setEliminar}
            />
          ))
        )}
      </div>

      <ModalCrearEnlace
        open={crearOpen}
        onClose={() => setCrearOpen(false)}
        soloAlumno={!esAdmin}
        onCreated={refetch}
      />

      <ModalEditarEnlace
        open={editar !== null}
        onClose={() => setEditar(null)}
        enlace={editar}
        onSaved={refetch}
      />

      <ConfirmDeleteModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={handleEliminar}
        entityName={eliminar ? eliminar.codigo : ''}
        entityType={t('accion_eliminar').toLowerCase()}
      />
    </div>
  );
}
