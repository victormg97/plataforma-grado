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

interface FichaAlumnoProps {
  alumnoId: string | null;
  open: boolean;
  onClose: () => void;
}

export function FichaAlumno({ alumnoId, open, onClose }: FichaAlumnoProps) {
  const t = useTranslations('alumnos');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clases, setClases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [notas, setNotas] = useState('');
  const [pasoPrueba, setPasoPrueba] = useState(false);

  const fetchFicha = useCallback(async () => {
    if (!alumnoId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/alumnos/${alumnoId}/ficha`);
      if (!res.ok) throw new Error('Error cargando ficha');
      const json = await res.json();
      setData(json);
      setClases(json.historial_clases ?? []);
      if (json.alumnos_extra) {
        setNotas(json.alumnos_extra.notas ?? '');
        setPasoPrueba(json.alumnos_extra.paso_prueba ?? false);
      } else {
        setNotas('');
        setPasoPrueba(false);
      }
    } catch {
      toast.error(t('ficha_error_cargar'));
    } finally {
      setLoading(false);
    }
  }, [alumnoId, t]);

  useEffect(() => {
    if (open && alumnoId) fetchFicha();
    if (!open) {
      setData(null);
      setClases([]);
    }
  }, [open, alumnoId, fetchFicha]);

  const handleSave = async () => {
    if (!alumnoId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/alumnos/${alumnoId}/ficha`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas, paso_prueba: pasoPrueba }),
      });
      if (!res.ok) throw new Error('Error guardando');
      toast.success(t('ficha_guardado'));
      fetchFicha();
    } catch {
      toast.error(t('ficha_error_guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleBloquear = async () => {
    if (!data || !confirm(t('confirm_bloquear', { nombre: `${data.nombre} ${data.apellido}` }))) return;
    try {
      const res = await fetch(`/api/alumnos/${alumnoId}/ficha`, {
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

  if (!alumnoId) return null;

  const extra = data?.alumnos_extra;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('ficha_titulo')}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="danger" size="sm" onClick={handleBloquear} disabled={loading || !data}>
            <ShieldAlert className="mr-1 h-4 w-4" /> {t('ficha_bloquear')}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !data}>
            <Save className="mr-1 h-4 w-4" /> {saving ? t('ficha_guardando') : t('ficha_guardar')}
          </Button>
        </div>
      }
    >
      {loading || !data ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Avatar nombre={data.nombre} apellido={data.apellido} avatarUrl={data.avatar_url} size="lg" />
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {data.nombre} {data.apellido}
              </h3>
              {extra?.paso_prueba && <StatusBadge status="graduado" />}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Mail className="h-4 w-4" /> {data.email}
            </div>
            {data.telefono && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <Phone className="h-4 w-4" /> {data.telefono}
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
