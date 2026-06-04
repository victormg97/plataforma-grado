'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Pencil, Trash2, UserX, UserCheck, Eye, CalendarDays } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { CardActions, type CardAction } from '@/components/common/CardActions';
import { BotonCompartir } from './BotonCompartir';
import { accionesDeFila } from '@/lib/enlaces/acciones';
import { controlNavegacionUsuario } from '@/lib/enlaces/navegacion';
import { formatearFechaCreacion } from '@/lib/enlaces/navegacion';
import type { EnlaceListItem } from '@/lib/enlaces/types';

interface FilaEnlaceProps {
  enlace: EnlaceListItem;
  rol: string;
  onEditar: (enlace: EnlaceListItem) => void;
  onToggleEstado: (enlace: EnlaceListItem, accion: 'habilitar' | 'deshabilitar') => void;
  onEliminar: (enlace: EnlaceListItem) => void;
}

const estadoBadgeClass: Record<string, string> = {
  activo: 'bg-green-50 text-[var(--color-success)] dark:bg-green-950/30',
  usado: 'bg-blue-50 text-[var(--color-info)] dark:bg-blue-950/30',
  deshabilitado: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function FilaEnlace({ enlace, rol, onEditar, onToggleEstado, onEliminar }: FilaEnlaceProps) {
  const t = useTranslations('enlaces');
  const router = useRouter();

  const acciones = accionesDeFila(
    {
      estado: enlace.estado,
      tipo: enlace.tipo,
      usuarioCreadoActivo: enlace.usuario?.activo ?? false,
    },
    rol,
  );

  const creadorNombre = enlace.creador
    ? `${enlace.creador.nombre} ${enlace.creador.apellido}`.trim()
    : t('creador_desconocido');

  const profesorNombre = enlace.profesor
    ? `${enlace.profesor.nombre} ${enlace.profesor.apellido}`.trim()
    : null;

  const rutaUsuario = controlNavegacionUsuario({
    tipo: enlace.tipo,
    usuario_creado: enlace.usuario_creado,
    usuarioActivo: enlace.usuario?.activo ?? false,
    usuarioExiste: enlace.usuario !== null,
  });

  const tipoLabel =
    enlace.tipo === 'profesor'
      ? t('tipos.profesor')
      : enlace.tipo === 'lector'
      ? t('tipos.lector')
      : t('tipos.alumno');
  const estadoClass = estadoBadgeClass[enlace.estado] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800';

  // Acciones para CardActions (excluye "compartir": tiene su propio botón con popover).
  const cardActions: CardAction[] = [];
  if (acciones.includes('editar')) {
    cardActions.push({
      key: 'editar',
      label: t('accion_editar'),
      icon: <Pencil className="size-4" />,
      onClick: () => onEditar(enlace),
    });
  }
  if (acciones.includes('navegar_usuario') && rutaUsuario) {
    cardActions.push({
      key: 'navegar',
      label: enlace.tipo === 'alumno' ? t('accion_ver_perfil') : t('accion_ver_clases'),
      icon: enlace.tipo === 'alumno' ? <Eye className="size-4" /> : <CalendarDays className="size-4" />,
      onClick: () => router.push(rutaUsuario),
    });
  }
  if (acciones.includes('deshabilitar')) {
    cardActions.push({
      key: 'deshabilitar',
      label: t('accion_deshabilitar'),
      icon: <UserX className="size-4" />,
      onClick: () => onToggleEstado(enlace, 'deshabilitar'),
    });
  }
  if (acciones.includes('habilitar')) {
    cardActions.push({
      key: 'habilitar',
      label: t('accion_habilitar'),
      icon: <UserCheck className="size-4" />,
      onClick: () => onToggleEstado(enlace, 'habilitar'),
    });
  }
  if (acciones.includes('eliminar')) {
    cardActions.push({
      key: 'eliminar',
      label: t('accion_eliminar'),
      icon: <Trash2 className="size-4" />,
      onClick: () => onEliminar(enlace),
      danger: true,
    });
  }

  return (
    <Card className="group flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoClass}`}>
            {t(`estados.${enlace.estado}`)}
          </span>
          <span className="inline-flex items-center rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
            {tipoLabel}
          </span>
        </div>
        <p className="mt-1.5 text-sm font-medium text-[var(--color-text-primary)]">
          {creadorNombre}
          <span className="ml-2 font-normal text-[var(--color-text-muted)]">
            {formatearFechaCreacion(enlace.created_at)}
          </span>
        </p>
        <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {(enlace.tipo === 'alumno') && (
            <span>
              {t('columna_profesor')}:{' '}
              {profesorNombre ?? <span className="italic">{t('sin_profesor')}</span>}
            </span>
          )}
          {enlace.estado === 'usado' && (
            <span className="ml-2">
              {enlace.usuario
                ? `${enlace.usuario.nombre} ${enlace.usuario.apellido}`.trim()
                : t('usuario_no_disponible')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 self-end sm:self-center">
        <BotonCompartir codigo={enlace.codigo} label={t('accion_compartir')} />
        {cardActions.length > 0 && <CardActions actions={cardActions} />}
      </div>
    </Card>
  );
}
