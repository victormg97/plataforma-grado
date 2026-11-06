'use client';

/**
 * Panel flotante del Filtro_Agenda.
 *
 * - Escritorio: popover anclado bajo el botón (`absolute`), por lo que no empuja
 *   ni reordena el contenido de la página.
 * - Móvil: hoja flotante pegada al borde superior de la pantalla (`fixed`, en un
 *   portal para no depender de ancestros con `transform`). No lleva telón: la
 *   agenda sigue visible debajo para ver cómo reacciona al filtrar.
 *
 * Se cierra con el botón X, con Escape o al pulsar fuera. Los filtros se aplican
 * en cada clic; no hay botón «aplicar».
 */

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { m, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Check,
  FilterX,
  GraduationCap,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  UsersRound,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  alternarId,
  alternarTipo,
  contarFiltrosActivos,
  type ClaveTipoFiltro,
  type FiltroAgenda,
} from '@/lib/agenda/calendario';
import { SelectorPersonas } from './SelectorPersonas';
import type { PersonaFiltro } from './personas';

const MEDIA_ESCRITORIO = '(min-width: 640px)';

function useEsEscritorio(): boolean {
  return useSyncExternalStore(
    (notificar) => {
      const mq = window.matchMedia(MEDIA_ESCRITORIO);
      mq.addEventListener('change', notificar);
      return () => mq.removeEventListener('change', notificar);
    },
    () => window.matchMedia(MEDIA_ESCRITORIO).matches,
    () => true,
  );
}

interface TipoTile {
  clave: ClaveTipoFiltro;
  labelKey: 'filtro_clases' | 'filtro_entradas' | 'filtro_actividades';
  icono: ReactNode;
  color: string;
}

const TIPOS: TipoTile[] = [
  {
    clave: 'clases',
    labelKey: 'filtro_clases',
    icono: <GraduationCap className="size-5" />,
    color: 'var(--color-brand-gold)',
  },
  {
    clave: 'entradasPersonales',
    labelKey: 'filtro_entradas',
    icono: <StickyNote className="size-5" />,
    color: 'var(--color-agenda-tipo-entrada)',
  },
  {
    clave: 'actividades',
    labelKey: 'filtro_actividades',
    icono: <Sparkles className="size-5" />,
    color: 'var(--color-agenda-tipo-actividad)',
  },
];

export interface PanelFiltroAgendaProps {
  filtro: FiltroAgenda;
  /** Aplica un cambio partiendo siempre del estado vigente. */
  onCambiar: (actualizar: (previo: FiltroAgenda) => FiltroAgenda) => void;
  onLimpiar: () => void;
  /** `devolverFoco` es true cuando se cierra por teclado o con la X. */
  onCerrar: (devolverFoco: boolean) => void;
  /**
   * Elementos que cuentan como «dentro» del filtro: pulsar en ellos no cierra el
   * panel (el botón, los chips…).
   */
  contenedorRef: RefObject<HTMLElement | null>;
  profesores?: PersonaFiltro[];
  alumnos?: PersonaFiltro[];
  usuarioActualId?: string;
  /** Con el panel de escritorio, hacia qué lado del botón se alinea. */
  alineacion: 'inicio' | 'fin';
}

export function PanelFiltroAgenda({
  filtro,
  onCambiar,
  onLimpiar,
  onCerrar,
  contenedorRef,
  profesores,
  alumnos,
  usuarioActualId,
  alineacion,
}: PanelFiltroAgendaProps) {
  const t = useTranslations('agendaCalendario');
  const tituloId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const reducirMovimiento = useReducedMotion();
  const esEscritorio = useEsEscritorio();

  const total = contarFiltrosActivos(filtro);
  const conProfesores = profesores !== undefined;
  const conAlumnos = alumnos !== undefined;
  const conPersonas = conProfesores || conAlumnos;
  const dosColumnas = conProfesores && conAlumnos;

  // Un solo tipo visible: no se puede ocultar (el calendario quedaría vacío).
  const tiposVisibles = [filtro.clases, filtro.entradasPersonales, filtro.actividades].filter(Boolean).length;

  // Foco al panel al abrir, para que teclado y lectores de pantalla entren en él.
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function alPulsarTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar(true);
    }
    function alPulsarFuera(e: PointerEvent) {
      const destino = e.target as Node | null;
      if (!destino) return;
      if (panelRef.current?.contains(destino)) return;
      if (contenedorRef.current?.contains(destino)) return;
      onCerrar(false);
    }
    document.addEventListener('keydown', alPulsarTecla);
    document.addEventListener('pointerdown', alPulsarFuera);
    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      document.removeEventListener('pointerdown', alPulsarFuera);
    };
  }, [onCerrar, contenedorRef]);

  const animacion = reducirMovimiento
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : esEscritorio
      ? {
          initial: { opacity: 0, y: -6, scale: 0.98 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -4, scale: 0.98 },
        }
      : {
          initial: { opacity: 0, y: -24 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -24 },
        };

  const panel = (
    <m.div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={tituloId}
      tabIndex={-1}
      {...animacion}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      style={{ transformOrigin: alineacion === 'fin' ? 'top right' : 'top left' }}
      className={cn(
        'z-[60] flex flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)] outline-none',
        esEscritorio
          ? cn(
              'absolute top-full mt-2 max-h-[min(40rem,75dvh)] rounded-[var(--radius-lg)]',
              alineacion === 'fin' ? 'right-0' : 'left-0',
              dosColumnas
                ? 'w-[min(40rem,calc(100vw-2rem))]'
                : 'w-[min(24rem,calc(100vw-2rem))]',
            )
          : 'fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] max-h-[72dvh] rounded-[var(--radius-xl)] ring-1 ring-black/5',
      )}
    >
      {/* Cabecera */}
      <header className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]"
        >
          <SlidersHorizontal className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={tituloId} className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t('filtro_titulo')}
          </h2>
          <p className="truncate text-xs text-[var(--color-text-muted)]" aria-live="polite">
            {total > 0 ? t('filtro_activos', { count: total }) : t('filtro_sin_activos')}
          </p>
        </div>
        <button
          type="button"
          onClick={onLimpiar}
          disabled={total === 0}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] disabled:pointer-events-none disabled:opacity-40"
        >
          <FilterX className="size-4" aria-hidden />
          {t('filtro_limpiar')}
        </button>
        <button
          type="button"
          onClick={() => onCerrar(true)}
          aria-label={t('filtro_cerrar')}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
        >
          <X className="size-5" />
        </button>
      </header>

      {/* Cuerpo */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
        {/* Qué tipos de elemento se muestran */}
        <section aria-label={t('filtro_seccion_tipos')} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('filtro_seccion_tipos')}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map((tipo) => {
              const activo = filtro[tipo.clave];
              const bloqueado = activo && tiposVisibles === 1;
              return (
                <button
                  key={tipo.clave}
                  type="button"
                  aria-pressed={activo}
                  disabled={bloqueado}
                  title={bloqueado ? t('filtro_al_menos_un_tipo') : undefined}
                  onClick={() => onCambiar((previo) => alternarTipo(previo, tipo.clave))}
                  className={cn(
                    'relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-3 text-center text-xs font-medium leading-tight transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] sm:text-sm',
                    activo
                      ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-text-primary)]'
                      : 'border-dashed border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]',
                    bloqueado && 'cursor-not-allowed',
                  )}
                >
                  <span
                    aria-hidden
                    style={{ color: tipo.color }}
                    className={cn('transition-opacity', !activo && 'opacity-40')}
                  >
                    {tipo.icono}
                  </span>
                  <span className={cn(!activo && 'line-through decoration-1')}>{t(tipo.labelKey)}</span>
                  <span
                    aria-hidden
                    className={cn(
                      'absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full border transition-colors',
                      activo
                        ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)] text-[var(--color-brand-black)]'
                        : 'border-[var(--color-border-strong)]',
                    )}
                  >
                    {activo && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Personas */}
        {conPersonas && (
          <div className={cn('grid gap-5', dosColumnas && 'sm:grid-cols-2')}>
            {conProfesores && (
              <SelectorPersonas
                titulo={t('filtro_seccion_profesores')}
                icono={<ShieldCheck className="size-3.5" />}
                placeholderBusqueda={t('filtro_buscar_profesores')}
                personas={profesores}
                seleccionados={filtro.profesores}
                usuarioActualId={usuarioActualId}
                onAlternar={(id) =>
                  onCambiar((previo) => ({ ...previo, profesores: alternarId(previo.profesores, id) }))
                }
                onLimpiar={() => onCambiar((previo) => ({ ...previo, profesores: [] }))}
              />
            )}
            {conAlumnos && (
              <SelectorPersonas
                titulo={t('filtro_seccion_alumnos')}
                icono={<UsersRound className="size-3.5" />}
                placeholderBusqueda={t('filtro_buscar_alumnos')}
                personas={alumnos}
                seleccionados={filtro.alumnos}
                usuarioActualId={usuarioActualId}
                onAlternar={(id) =>
                  onCambiar((previo) => ({ ...previo, alumnos: alternarId(previo.alumnos, id) }))
                }
                onLimpiar={() => onCambiar((previo) => ({ ...previo, alumnos: [] }))}
              />
            )}
          </div>
        )}
      </div>
    </m.div>
  );

  return esEscritorio ? panel : createPortal(panel, document.body);
}
