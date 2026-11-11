'use client';
import { ClipboardList } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useCedulariosPropios } from './useCedulariosPropios';

/** Profile popover item: "Asignar cedulario" or "Revisar cedulario(s)". Hidden until it resolves. */
export function CedularioPropioMenuItem() {
  const t = useTranslations('perfil');
  const { esStaff, listo, accion, totalActivas, abrirAsignar, abrirRevisar } =
    useCedulariosPropios();
  if (!esStaff || !listo) return null;
  return (
    <DropdownMenuItem
      onClick={accion === 'asignar' ? abrirAsignar : abrirRevisar}
      className="cursor-pointer"
    >
      <ClipboardList className="mr-2 size-4" />
      {accion === 'asignar'
        ? t('asignar_cedulario')
        : t('revisar_cedularios', { count: totalActivas })}
    </DropdownMenuItem>
  );
}
