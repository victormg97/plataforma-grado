'use client';

/**
 * Componente de filtro del calendario de la agenda (Requisitos 12.3, 12.4).
 *
 * Tres switches que controlan la visibilidad de Clases, Entradas Personales y
 * Actividades en la vista de calendario. El estado vive en el query param `agenda`
 * y no modifica datos persistidos.
 */

import { useTranslations } from 'next-intl';
import { useFiltroAgenda } from '@/lib/agenda/calendario';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function FiltroAgenda() {
  const t = useTranslations('agendaCalendario');
  const [filtro, setFiltro] = useFiltroAgenda();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Switch
          checked={filtro.clases}
          onCheckedChange={(checked) =>
            setFiltro({ ...filtro, clases: checked })
          }
          id="filtro-clases"
        />
        <Label htmlFor="filtro-clases">{t('filtro_clases')}</Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={filtro.entradasPersonales}
          onCheckedChange={(checked) =>
            setFiltro({ ...filtro, entradasPersonales: checked })
          }
          id="filtro-entradas"
        />
        <Label htmlFor="filtro-entradas">{t('filtro_entradas')}</Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={filtro.actividades}
          onCheckedChange={(checked) =>
            setFiltro({ ...filtro, actividades: checked })
          }
          id="filtro-actividades"
        />
        <Label htmlFor="filtro-actividades">{t('filtro_actividades')}</Label>
      </div>
    </div>
  );
}
