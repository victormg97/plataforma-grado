'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, Calendar, Mail, Phone, Save, ShieldAlert, University } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import { toast } from 'sonner';
import type { AlumnoConExtra } from '@/components/alumnos/AlumnoCard';
import type { Asistencia, Horario } from '@/lib/supabase/types';

type ClaseHistorial = Horario & {
  asistencia: Asistencia[];
};

interface FichaAlumnoProps {
  alumno: AlumnoConExtra | null;
  open: boolean;
  onClose: () => void;
}

export function FichaAlumno({ alumno, open, onClose }: FichaAlumnoProps) {
  const t = useTranslations('alumnos');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const [clases, setClases] = useState<ClaseHistorial[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const extra = alumno
    ? Array.isArray(alumno.alumnos_extra)
      ? alumno.alumnos_extra[0]
      : alumno.alumnos_extra
    : null;

  const [notas, setNotas] = useState(extra?.notas ?? '');
  const [pasoPrueba, setPasoPrueba] = useState(extra?.paso_prueba ?? false);

  const fetchFicha = useCallback(async () => {
    if (!alumno) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/alumnos/${alumno.id}/ficha`);
      if (!res.ok) throw new Error('Error cargando ficha');
      const data = await res.json();
      setClases(data.clases ?? []);
      if (data.extra) {
        setNotas(data.extra.notas ?? '');
        setPasoPrueba(data.extra.paso_prueba ?? false);
      }
    } catch {
      toast.error(t('ficha_error_cargar'));
    } finally {
      setLoading(false);
    }
  }, [alumno]);

  useEffect(() => {
    if (open && alumno) fetchFicha();
  }, [open, alumno, fetchFicha]);

  useEffect(() => {
    if (extra) {
      setNotas(extra.notas ?? '');
      setPasoPrueba(extra.paso_prueba ?? false);
    }
  }, [extra]);

  const handleSave = async () => {
    if (!alumno) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/alumnos/${alumno.id}/ficha`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas, paso_prueba: pasoPrueba }),
      });
      if (!res.ok) throw new Error('Error guardando');
      toast.success(t('ficha_guardado'));
    } catch {
      toast.error(t('ficha_error_guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleBloquear = async () => {
    if (!alumno || !confirm(t('confirm_bloquear', { nombre: `${alumno.nombre} ${alumno.apellido}` }))) return;
    try {
      const res = await fetch(`/api/alumnos/${alumno.id}/ficha`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: false }),
      });
      if (!res.ok) throw new Error('Error bloqueando');
      toast.success(t('exito_bloqueado'));
      onClose();
    } catch {
      toast.error(t('ficha_nopudo_bloquear'));
    }
  };

  if (!alumno) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('ficha_titulo')}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="danger" size="sm" onClick={handleBloquear}>
            <ShieldAlert className="mr-1 h-4 w-4" /> {t('ficha_bloquear')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" /> {saving ? t('ficha_guardando') : t('ficha_guardar')}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Avatar nombre={alumno.nombre} apellido={alumno.apellido} avatarUrl={alumno.avatar_url} size="lg" />
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {alumno.nombre} {alumno.apellido}
              </h3>
              {extra?.paso_prueba && <StatusBadge status="graduado" />}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Mail className="h-4 w-4" /> {alumno.email}
            </div>
            {alumno.telefono && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <Phone className="h-4 w-4" /> {alumno.telefono}
              </div>
            )}
            {extra?.universidad && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <University className="h-4 w-4" /> {extra.universidad}
              </div>
            )}
            {extra?.año_ingreso && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <BookOpen className="h-4 w-4" /> {t('ficha_ingreso')}: {extra.año_ingreso}
              </div>
            )}
          </div>

          {/* Paso prueba */}
          <label className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={pasoPrueba}
              onChange={(e) => setPasoPrueba(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand-gold)]"
            />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('ficha_paso_prueba')}</span>
          </label>

          {/* Notas */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('ficha_notas')}</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
              placeholder={t('ficha_notas_placeholder')}
            />
          </div>

          {/* Historial de clases */}
          <div>
            <h4 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <Calendar className="mr-1 inline-block h-4 w-4" /> {t('ficha_ultimas_clases')}
            </h4>
            {clases.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">{t('ficha_sin_clases')}</p>
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {clases.map((c) => {
                  const estado = c.asistencia?.[0]?.estado ?? 'pendiente';
                  return (
                    <div key={c.id} className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm">
                      <span className="text-[var(--color-text-primary)]">
                        {format(new Date(c.fecha), locale === 'en' ? 'MMM d yyyy' : 'd MMM yyyy', { locale: dateFnsLocale })} — {c.hora_inicio.slice(0, 5)}
                      </span>
                      <StatusBadge status={estado} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
