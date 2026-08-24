'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Calendar, Clock, MapPin, Pencil, Trash2, User } from 'lucide-react';
import { format } from 'date-fns';
import { es as esDateFns, enUS } from 'date-fns/locale';

import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { RichDescription } from '@/components/common/RichDescription';
import { BotonConexion } from '@/components/agenda/conexion/BotonConexion';
import { BotonOcultar } from '@/components/agenda/ocultacion/BotonOcultar';
import { IndicadorVisibilidad } from '@/components/agenda/visibilidad/IndicadorVisibilidad';
import { colorDeCategoria } from '@/lib/agenda/calendario';
import type { EventoAgendaProyectado } from '@/lib/agenda/nucleo';

// ─── Props ──────────────────────────────────────────────────────────────────

interface DetalleEventoAgendaProps {
  evento: EventoAgendaProyectado | null;
  open: boolean;
  onClose: () => void;
  onEditar?: () => void;
  onEliminar?: () => void;
  /** ID del usuario autenticado, para IndicadorVisibilidad */
  usuarioId: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DetalleEventoAgenda({
  evento,
  open,
  onClose,
  onEditar,
  onEliminar,
  usuarioId,
}: DetalleEventoAgendaProps) {
  const t = useTranslations('agendaCalendario');
  const tCat = useTranslations('agendaNucleo.categorias');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : esDateFns;

  const footer = evento?.puede_editar ? (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        icon={<Pencil className="size-4" />}
        onClick={onEditar}
      >
        {t('btn_editar')}
      </Button>
      <Button
        variant="danger"
        size="sm"
        icon={<Trash2 className="size-4" />}
        onClick={onEliminar}
      >
        {t('btn_eliminar')}
      </Button>
    </div>
  ) : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={evento?.titulo ?? t('detalle_titulo')}
      footer={footer}
    >
      {evento && (
        <div className="space-y-4">
          {/* Categoría badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">
              {t('detalle_categoria')}:
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: colorDeCategoria(evento.categoria) }}
              />
              {tCat(evento.categoria)}
            </span>
          </div>

          {/* Fecha y hora */}
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            {evento.dia_completo ? (
              <>
                <Calendar className="size-4 shrink-0" />
                <span>
                  {formatFecha(evento.fecha, locale, dateFnsLocale)}
                  {' \u00B7 '}
                  {t('dia_completo')}
                </span>
              </>
            ) : (
              <>
                <Clock className="size-4 shrink-0" />
                <span>
                  {formatFecha(evento.fecha, locale, dateFnsLocale)}
                  {' \u00B7 '}
                  {evento.hora_inicio} – {evento.hora_fin}
                </span>
              </>
            )}
          </div>

          {/* Autor */}
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <User className="size-4 shrink-0" />
            <span>
              {t('detalle_autor')}: {evento.autor.nombre} {evento.autor.apellido}
            </span>
          </div>

          {/* Descripción (solo lectura completa) */}
          {evento.lectura === 'completa' && evento.descripcion && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                {t('detalle_descripcion')}
              </span>
              <RichDescription html={evento.descripcion} />
            </div>
          )}

          {/* Lugar */}
          {evento.lugar && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <MapPin className="size-4 shrink-0" />
              <span>{t('detalle_lugar')}: {evento.lugar}</span>
            </div>
          )}

          {/* Enlace de conexión */}
          <BotonConexion enlace={evento.enlace_conexion} />

          {/* Nota (solo lectura completa) */}
          {evento.lectura === 'completa' && evento.nota && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                {t('detalle_nota')}
              </span>
              <RichDescription html={evento.nota} />
            </div>
          )}

          {/* Visibilidad */}
          <IndicadorVisibilidad
            visibilidad={evento.visibilidad}
            esPropio={evento.autor.id === usuarioId}
          />

          {/* Ocultación de actividad */}
          <BotonOcultar eventoId={evento.id} tipo={evento.tipo} oculto={evento.oculto} />
        </div>
      )}
    </Modal>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Formatea una fecha `YYYY-MM-DD` en el formato largo del idioma activo,
 * igual que se aplica a las Clases en los calendarios existentes.
 */
function formatFecha(
  fecha: string,
  locale: string,
  dateFnsLocale: typeof esDateFns | typeof enUS
): string {
  const date = new Date(fecha + 'T12:00:00');
  const pattern = locale === 'en' ? 'EEEE, MMMM d' : "EEEE d 'de' MMMM";
  return format(date, pattern, { locale: dateFnsLocale });
}
