'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Label } from '@/components/ui/label';
import { AppSelect } from '@/components/common/AppSelect';
import type { PersonaResumen } from '@/lib/enlaces/types';

interface ModalCrearEnlaceProps {
  open: boolean;
  onClose: () => void;
  /** true cuando el creador es un profesor habilitado (solo alumno, sin selector). */
  soloAlumno: boolean;
  onCreated: () => void;
}

const SIN_PROFESOR = '__sin__';

export function ModalCrearEnlace({ open, onClose, soloAlumno, onCreated }: ModalCrearEnlaceProps) {
  const t = useTranslations('enlaces');
  const [tipo, setTipo] = useState<'profesor' | 'alumno'>(soloAlumno ? 'alumno' : 'alumno');
  const [profesor, setProfesor] = useState<string>(SIN_PROFESOR);
  const [profesores, setProfesores] = useState<PersonaResumen[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setTipo('alumno');
      setProfesor(SIN_PROFESOR);
    }
  }, [open]);

  // Cargar profesores asignables (solo admin, solo cuando aplica)
  useEffect(() => {
    if (!open || soloAlumno) return;
    fetch('/api/enlaces-invitacion/profesores')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProfesores(Array.isArray(data) ? data : []))
      .catch(() => setProfesores([]));
  }, [open, soloAlumno]);

  const handleCrear = async () => {
    setLoading(true);
    try {
      const payload: { tipo: string; profesor_asignado?: string | null } = { tipo };
      if (tipo === 'alumno' && profesor !== SIN_PROFESOR) {
        payload.profesor_asignado = profesor;
      }
      const res = await fetch('/api/enlaces-invitacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(t('exito_crear'));
      onCreated();
      onClose();
    } catch {
      toast.error(t('error_crear'));
    } finally {
      setLoading(false);
    }
  };

  const tipoOptions = [
    { value: 'alumno', label: t('tipos.alumno') },
    { value: 'profesor', label: t('tipos.profesor') },
  ];

  const profesorOptions = [
    { value: SIN_PROFESOR, label: t('sin_profesor') },
    ...profesores.map((p) => ({ value: p.id, label: `${p.nombre} ${p.apellido}`.trim() })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('modal_crear_titulo')}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('cancelar')}
          </Button>
          <Button onClick={handleCrear} loading={loading} disabled={loading}>
            {t('crear_enlace')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!soloAlumno && (
          <div className="space-y-2">
            <Label className="text-[var(--color-text-secondary)]">{t('campo_tipo')}</Label>
            <AppSelect
              value={tipo}
              onChange={(v) => setTipo(v as 'profesor' | 'alumno')}
              options={tipoOptions}
              placeholder={t('placeholder_tipo')}
              className="w-full"
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              {tipo === 'profesor' ? t('tipo_profesor') : t('tipo_alumno')}
            </p>
          </div>
        )}

        {!soloAlumno && tipo === 'alumno' && (
          <div className="space-y-2">
            <Label className="text-[var(--color-text-secondary)]">{t('campo_profesor')}</Label>
            <AppSelect
              value={profesor}
              onChange={setProfesor}
              options={profesorOptions}
              placeholder={t('placeholder_profesor')}
              className="w-full"
            />
          </div>
        )}

        {soloAlumno && (
          <p className="text-sm text-[var(--color-text-secondary)]">{t('tipo_alumno')}</p>
        )}
      </div>
    </Modal>
  );
}
