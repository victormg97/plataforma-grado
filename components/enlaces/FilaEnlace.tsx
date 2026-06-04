'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Pencil, Trash2, UserX, UserCheck, Eye, CalendarDays,
  UserCircle, GraduationCap, BookOpen, CheckCircle2, Clock, Link2,
} from 'lucide-react';
import { Card } from '@/components/common/Card';
import { CardActions, type CardAction } from '@/components/common/CardActions';
import { BotonCompartir } from './BotonCompartir';
import { accionesDeFila } from '@/lib/enlaces/acciones';
import { controlNavegacionUsuario, formatearFechaCreacion } from '@/lib/enlaces/navegacion';
import type { EnlaceListItem } from '@/lib/enlaces/types';

interface FilaEnlaceProps {
  enlace: EnlaceListItem;
  rol: string;
  onEditar: (enlace: EnlaceListItem) => void;
  onToggleEstado: (enlace: EnlaceListItem, accion: 'habilitar' | 'deshabilitar') => void;
  onEliminar: (enlace: EnlaceListItem) => void;
}

// ─── Estilos de estado ────────────────────────────────────────────────────────

const ESTADO_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  activo:        { bg: 'bg-green-50 dark:bg-green-950/30',  text: 'text-[var(--color-success)]',           dot: 'bg-[var(--color-success)]' },
  usado:         { bg: 'bg-blue-50 dark:bg-blue-950/30',    text: 'text-[var(--color-info)]',              dot: 'bg-[var(--color-info)]' },
  deshabilitado: { bg: 'bg-gray-100 dark:bg-gray-800',      text: 'text-gray-500 dark:text-gray-400',      dot: 'bg-gray-400' },
};

// ─── Iconos de tipo ───────────────────────────────────────────────────────────

const TIPO_ICON: Record<string, React.ReactNode> = {
  alumno:   <GraduationCap className="size-3.5" />,
  profesor: <UserCircle className="size-3.5" />,
  lector:   <BookOpen className="size-3.5" />,
};

// ─── Componente ──────────────────────────────────────────────────────────────

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

  const rutaUsuario = controlNavegacionUsuario({
    tipo: enlace.tipo,
    usuario_creado: enlace.usuario_creado,
    usuarioActivo: enlace.usuario?.activo ?? false,
    usuarioExiste: enlace.usuario !== null,
  });

  const tipoLabel =
    enlace.tipo === 'profesor' ? t('tipos.profesor') :
    enlace.tipo === 'lector'   ? t('tipos.lector')   :
    t('tipos.alumno');

  const estadoStyle = ESTADO_STYLES[enlace.estado] ?? ESTADO_STYLES.deshabilitado;

  const creadorNombre = enlace.creador
    ? `${enlace.creador.nombre} ${enlace.creador.apellido}`.trim()
    : t('creador_desconocido');

  const profesorNombre = enlace.profesor
    ? `${enlace.profesor.nombre} ${enlace.profesor.apellido}`.trim()
    : null;

  const usuarioNombre = enlace.usuario
    ? [enlace.usuario.nombre, enlace.usuario.apellido, enlace.usuario.apellido_materno]
        .filter(Boolean).join(' ')
    : null;

  const usuarioLabel =
    enlace.tipo === 'profesor' ? t('tipos.profesor') :
    enlace.tipo === 'lector'   ? t('tipos.lector')   :
    t('tipos.alumno');

  const fechaCreacion = formatearFechaCreacion(enlace.created_at);
  const fechaUso = enlace.estado === 'usado' && enlace.updated_at
    ? formatearFechaCreacion(enlace.updated_at)
    : null;

  // ── Acciones del footer ──
  const cardActions: CardAction[] = [];
  if (acciones.includes('editar')) {
    cardActions.push({ key: 'editar', label: t('accion_editar'), icon: <Pencil className="size-4" />, onClick: () => onEditar(enlace) });
  }
  if (acciones.includes('navegar_usuario') && rutaUsuario) {
    cardActions.push({
      key: 'navegar',
      label: enlace.tipo === 'alumno' || enlace.tipo === 'lector' ? t('accion_ver_perfil') : t('accion_ver_clases'),
      icon: enlace.tipo === 'alumno' || enlace.tipo === 'lector' ? <Eye className="size-4" /> : <CalendarDays className="size-4" />,
      onClick: () => router.push(rutaUsuario),
    });
  }
  if (acciones.includes('deshabilitar')) {
    cardActions.push({ key: 'deshabilitar', label: t('accion_deshabilitar'), icon: <UserX className="size-4" />, onClick: () => onToggleEstado(enlace, 'deshabilitar') });
  }
  if (acciones.includes('habilitar')) {
    cardActions.push({ key: 'habilitar', label: t('accion_habilitar'), icon: <UserCheck className="size-4" />, onClick: () => onToggleEstado(enlace, 'habilitar') });
  }
  if (acciones.includes('eliminar')) {
    cardActions.push({ key: 'eliminar', label: t('accion_eliminar'), icon: <Trash2 className="size-4" />, onClick: () => onEliminar(enlace), danger: true });
  }

  const tieneAcciones = enlace.estado === 'activo' || cardActions.length > 0;

  return (
    <Card padding="none" className="group flex flex-col overflow-hidden">

      {/* ── Cuerpo ── */}
      <div className="flex flex-col gap-2.5 p-4 flex-1">

        {/* Fila 1: badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${estadoStyle.bg} ${estadoStyle.text}`}>
            <span className={`size-1.5 rounded-full ${estadoStyle.dot}`} />
            {t(`estados.${enlace.estado}`)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
            {TIPO_ICON[enlace.tipo] ?? <Link2 className="size-3.5" />}
            {tipoLabel}
          </span>
        </div>

        {/* Fila 2: usuario o estado de espera */}
        {enlace.estado === 'usado' && usuarioNombre ? (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--color-info)]" />
            <div className="min-w-0">
              <p className="text-sm leading-snug text-[var(--color-text-primary)]">
                <span className="text-[var(--color-text-muted)]">{usuarioLabel}:</span>
                {' '}
                <span className="font-medium">{usuarioNombre}</span>
                {enlace.usuario && !enlace.usuario.activo && (
                  <span className="ml-1.5 text-xs text-[var(--color-text-muted)]">({t('cuenta_inactiva')})</span>
                )}
              </p>
              {enlace.usuario?.email && (
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)] truncate">{enlace.usuario.email}</p>
              )}
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{t('registro_completado')}</p>
            </div>
          </div>
        ) : enlace.estado === 'activo' ? (
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <Clock className="size-4 shrink-0" />
            <p className="text-sm">{t('esperando_registro')}</p>
          </div>
        ) : null}

        {/* Fila 3: metadata */}
        <div className="space-y-0.5 text-xs text-[var(--color-text-muted)]">
          <div className="flex flex-wrap items-center gap-x-1.5">
            <span className="font-medium text-[var(--color-text-secondary)]">{t('creado_por')}:</span>
            <span>{creadorNombre}</span>
            <span className="text-[var(--color-border-strong)]">·</span>
            <span>{fechaCreacion}</span>
          </div>
          {fechaUso && (
            <div className="flex flex-wrap items-center gap-x-1.5">
              <span className="font-medium text-[var(--color-text-secondary)]">{t('usado_el')}:</span>
              <span>{fechaUso}</span>
            </div>
          )}
          {enlace.tipo === 'alumno' && (
            <div className="flex flex-wrap items-center gap-x-1.5">
              <span className="font-medium text-[var(--color-text-secondary)]">{t('columna_profesor')}:</span>
              {profesorNombre
                ? <span>{profesorNombre}</span>
                : <span className="italic">{t('sin_profesor')}</span>
              }
            </div>
          )}
        </div>
      </div>

      {/* ── Footer de acciones ── */}
      {tieneAcciones && (
        <div className="flex items-center justify-end gap-1 border-t border-[var(--color-border)] px-3 py-2">
          {enlace.estado === 'activo' && (
            <BotonCompartir codigo={enlace.codigo} label={t('accion_compartir')} />
          )}
          {cardActions.length > 0 && (
            <CardActions
              actions={cardActions}
              alwaysVisible
            />
          )}
        </div>
      )}

    </Card>
  );
}
