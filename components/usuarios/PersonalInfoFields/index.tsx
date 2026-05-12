'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PersonalInfoFieldsProps {
  nombre: string;
  onNombreChange: (value: string) => void;
  apellido: string;
  onApellidoChange: (value: string) => void;
}

export function PersonalInfoFields({
  nombre,
  onNombreChange,
  apellido,
  onApellidoChange,
}: PersonalInfoFieldsProps) {
  const t = useTranslations('crear_usuario.alumno');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-[var(--color-text-primary)] border-b pb-2 border-[var(--color-border)]">
        {t('datos_personales')}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nombre">{t('nombre')} <span className="text-red-500">*</span></Label>
          <Input
            id="nombre"
            placeholder={t('nombre_placeholder')}
            autoComplete="off"
            value={nombre}
            onChange={(e) => onNombreChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="apellido">{t('apellidos')} <span className="text-red-500">*</span></Label>
          <Input
            id="apellido"
            placeholder={t('apellidos_placeholder')}
            autoComplete="off"
            value={apellido}
            onChange={(e) => onApellidoChange(e.target.value)}
            required
          />
        </div>
      </div>
    </div>
  );
}
