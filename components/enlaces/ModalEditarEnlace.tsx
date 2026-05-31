'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Label } from '@/components/ui/label';
import { AppSelect } from '@/components/common/AppSelect';
import type { EnlaceListItem, PersonaResumen } from '@/lib/enlaces/types';

interface ModalEditarEnlaceProps {
  open: boolean;
  onClose: () => void;
  enlace: EnlaceListItem | null;
  onSaved: () => void;
}

const SIN_PROFESOR = '__sin__';

export function ModalEditarEnlace({ open, onClose, enlace, onSaved }: ModalEditarEnlaceProps) {
  const t = useTranslations('enlaces');
  const [profesor, setProfesor] = useState<string>(SIN_PROFESOR);
  const [profesores, setProfesores] = useState<PersonaResumen[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && enlace) {
      setProfesor(enlace.profesor_asignado ?? SIN_PROFESOR);
    }
  }, [open, enlace]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/enlaces-invitacion/profesores')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProfesores(Array.isArray(data) ? data : []))
      .catch(() => setProfesores([]));
  }, [open]);

  const handleGuardar = async () => {
    if (!enlace) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/enlaces-invitacion/${enlace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profesor_asignado: profesor === SIN_PROFESOR ? null : profesor }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('exito_editar'));
      onSaved();
      onClose();
    } catch {
      toast.error(t('error_accion'));
    } finally {
      setLoading(false);
    }
  };

  const profesorOptions = [
    { value: SIN_PROFESOR, label: t('sin_profesor') },
    ...profesores.map((p) => ({ value: p.id, label: `${p.nombre} ${p.apellido}`.trim() })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('modal_editar_titulo')}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('cancelar')}
          </Button>
          <Button onClick={handleGuardar} loading={loading} disabled={loading}>
            {t('guardar')}
          </Button>
        </div>
      }
    >
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
    </Modal>
  );
}
