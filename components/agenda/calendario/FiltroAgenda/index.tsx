'use client';

/**
 * Filtro_Agenda (Requisitos 12.3, 12.4).
 *
 * Botón «Filtrar» que abre un panel flotante (ver `PanelFiltroAgenda`) para:
 *   - mostrar u ocultar Clases, Entradas personales y Actividades;
 *   - elegir uno o varios profesores/admins y uno o varios alumnos.
 *
 * Los cambios se aplican en cada clic y viven en la URL (`agenda`, `prof`,
 * `alu`); no modifican datos persistidos. Junto al botón se muestran como chips
 * los filtros activos, que se pueden quitar de uno en uno sin abrir el panel.
 *
 * Es reutilizable: cada selector de personas aparece solo si se le pasa su lista,
 * así que una vista de alumno puede usar solo los tipos y una de profesor añadir
 * únicamente `alumnos`. Para aplicar el filtro a los datos, la vista usa
 * `useFiltroAgenda` con `claseVisible`, `bloqueoVisible` y `eventoAgendaVisible`.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence } from 'framer-motion';
import { EyeOff, Filter, Plus, X } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { cn } from '@/lib/utils';
import {
  FILTRO_POR_DEFECTO,
  alternarId,
  contarFiltrosActivos,
  useFiltroAgenda,
  type ClaveTipoFiltro,
} from '@/lib/agenda/calendario';
import { PanelFiltroAgenda } from './PanelFiltroAgenda';
import { nombreCorto, type PersonaFiltro } from './personas';

export type { PersonaFiltro } from './personas';

/** Máximo de chips visibles junto al botón; el resto se resume en «+N». */
const MAX_CHIPS = 3;

interface FiltroAgendaProps {
  /** Profesores y admins elegibles. Si se omite, no se muestra ese selector. */
  profesores?: PersonaFiltro[];
  /** Alumnos elegibles. Si se omite, no se muestra ese selector. */
  alumnos?: PersonaFiltro[];
  /** Usuario actual: se ordena primero y se marca con «(tú)». */
  usuarioActualId?: string;
  /** Lado del botón al que se alinea el panel en escritorio. */
  alineacion?: 'inicio' | 'fin';
  /** Oculta los chips de filtros activos junto al botón. */
  ocultarChips?: boolean;
  className?: string;
}

interface ChipInfo {
  key: string;
  label: string;
  ariaLabel: string;
  icono: ReactNode;
  oculto?: boolean;
  onQuitar: () => void;
}

const TIPOS_CHIP: { clave: ClaveTipoFiltro; labelKey: 'filtro_clases' | 'filtro_entradas' | 'filtro_actividades' }[] = [
  { clave: 'clases', labelKey: 'filtro_clases' },
  { clave: 'entradasPersonales', labelKey: 'filtro_entradas' },
  { clave: 'actividades', labelKey: 'filtro_actividades' },
];

export function FiltroAgenda({
  profesores,
  alumnos,
  usuarioActualId,
  alineacion = 'inicio',
  ocultarChips = false,
  className,
}: FiltroAgendaProps) {
  const t = useTranslations('agendaCalendario');
  const [filtro, setFiltro] = useFiltroAgenda();
  const [abierto, setAbierto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const total = contarFiltrosActivos(filtro);

  const cerrar = useCallback((devolverFoco: boolean) => {
    setAbierto(false);
    if (devolverFoco) triggerRef.current?.focus();
  }, []);

  const limpiar = useCallback(() => setFiltro(FILTRO_POR_DEFECTO), [setFiltro]);

  // ─── Chips de filtros activos ─────────────────────────────────────────────
  const chips: ChipInfo[] = [];

  for (const { clave, labelKey } of TIPOS_CHIP) {
    if (filtro[clave]) continue;
    const label = t(labelKey);
    chips.push({
      key: `tipo:${clave}`,
      label,
      ariaLabel: t('filtro_mostrar_tipo', { tipo: label }),
      icono: <EyeOff className="size-3.5 shrink-0" aria-hidden />,
      oculto: true,
      onQuitar: () => setFiltro((previo) => ({ ...previo, [clave]: true })),
    });
  }

  const agregarChipsPersonas = (
    ids: string[],
    lista: PersonaFiltro[] | undefined,
    clave: 'profesores' | 'alumnos',
  ) => {
    // Con la lista aún sin cargar no se puede nombrar a nadie: se omiten.
    if (!lista || lista.length === 0) return;
    for (const id of ids) {
      const persona = lista.find((p) => p.id === id);
      const label = persona ? nombreCorto(persona) : t('filtro_persona_desconocida');
      chips.push({
        key: `${clave}:${id}`,
        label,
        ariaLabel: t('filtro_quitar_persona', { nombre: label }),
        icono: persona ? (
          <Avatar
            nombre={persona.nombre}
            apellido={persona.apellido}
            avatarUrl={persona.avatar_url}
            size="sm"
            className="size-5 shrink-0 text-[9px]"
          />
        ) : null,
        onQuitar: () =>
          setFiltro((previo) => ({ ...previo, [clave]: alternarId(previo[clave], id) })),
      });
    }
  };
  agregarChipsPersonas(filtro.profesores, profesores, 'profesores');
  agregarChipsPersonas(filtro.alumnos, alumnos, 'alumnos');

  const chipsVisibles = chips.slice(0, MAX_CHIPS);
  const chipsExtra = chips.length - chipsVisibles.length;

  return (
    <div ref={rootRef} className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-label={t('filtro_btn_aria')}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border bg-[var(--color-bg)] px-2.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]',
            abierto || total > 0
              ? 'border-[var(--color-brand-gold)] text-[var(--color-text-primary)]'
              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]',
          )}
        >
          <Filter className="size-3.5" />
          <span className="hidden sm:inline">{t('filtro_btn')}</span>
          {total > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-[var(--color-brand-gold)] text-[10px] font-bold leading-none text-[var(--color-brand-black)]">
              {total}
            </span>
          )}
        </button>

        <AnimatePresence>
          {abierto && (
            <PanelFiltroAgenda
              key="panel-filtro-agenda"
              filtro={filtro}
              onCambiar={setFiltro}
              onLimpiar={limpiar}
              onCerrar={cerrar}
              contenedorRef={rootRef}
              profesores={profesores}
              alumnos={alumnos}
              usuarioActualId={usuarioActualId}
              alineacion={alineacion}
            />
          )}
        </AnimatePresence>
      </div>

      {!ocultarChips &&
        chipsVisibles.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onQuitar}
            aria-label={chip.ariaLabel}
            title={chip.ariaLabel}
            className={cn(
              'group inline-flex h-8 max-w-[11rem] items-center gap-1.5 rounded-full border bg-[var(--color-bg)] pl-1.5 pr-2 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
              chip.oculto
                ? 'border-dashed border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:border-[var(--color-brand-gold)] hover:text-[var(--color-text-primary)]'
                : 'border-[var(--color-brand-gold)]/50 bg-[var(--color-brand-gold-muted)] text-[var(--color-text-primary)] hover:border-[var(--color-brand-gold)]',
            )}
          >
            {chip.icono}
            <span className={cn('truncate', chip.oculto && 'line-through decoration-1')}>
              {chip.label}
            </span>
            <X
              className="size-3.5 shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]"
              aria-hidden
            />
          </button>
        ))}

      {!ocultarChips && chipsExtra > 0 && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
        >
          <Plus className="size-3" aria-hidden />
          {chipsExtra}
        </button>
      )}
    </div>
  );
}
