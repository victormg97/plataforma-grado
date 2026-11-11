'use client';

/** Bodies of the three wizard steps: pick (cedularios or students), materias and confirm. */

import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/common/Avatar';
import { useQueryClient } from '@tanstack/react-query';
import type {
  EstadoWizard,
  ModoWizard,
  SeleccionMaterias,
} from '@/lib/cedularios/seguimiento/asignacion-wizard';
import type { AlumnoResumen } from '@/lib/queries/cedularios/seguimiento/resumen';
import { etiquetasAsignatario } from './etiquetasAsignatario';
import { AlumnosSelector } from './AlumnosSelector';
import { CedulariosMultiSelector } from './CedulariosMultiSelector';
import { MateriasSelector } from './MateriasSelector';
import { nombresDeSeleccionados, type CedularioFijo } from './asignarWizardTipos';

const CLASE_BLOQUE =
  'flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-[var(--space-sm)] py-2 text-sm text-[var(--color-text-primary)]';

const CLASE_ETIQUETA = 'text-sm font-medium text-[var(--color-text-primary)]';

type SetEstado = (actualizar: (previo: EstadoWizard) => EstadoWizard) => void;

// ---------------------------------------------------------------------------
// Fixed assignee block
// ---------------------------------------------------------------------------

interface AlumnoBloqueProps {
  alumnoFijo: AlumnoResumen;
  nombre: string;
}

function AlumnoBloque({ alumnoFijo, nombre }: AlumnoBloqueProps) {
  const t = useTranslations('cedularios.seguimiento');
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className={CLASE_ETIQUETA}>{t(etiquetasAsignatario(alumnoFijo.rol).fijo)}</span>
      <div className={CLASE_BLOQUE}>
        <Avatar
          nombre={alumnoFijo.nombre}
          apellido={alumnoFijo.apellido}
          avatarUrl={alumnoFijo.avatarUrl}
          size="sm"
          className="shrink-0"
        />
        <span className="min-w-0 truncate font-medium">{nombre}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: pick
// ---------------------------------------------------------------------------

interface PasoSeleccionProps {
  modo: ModoWizard;
  estado: EstadoWizard;
  setEstado: SetEstado;
  alumnoFijo: AlumnoResumen | null;
  nombreAlumno: string;
  cedularioFijo: CedularioFijo | null;
  idsAsignados: readonly string[];
  enviando: boolean;
  mostrarErrores: boolean;
}

export function PasoSeleccion({
  modo,
  estado,
  setEstado,
  alumnoFijo,
  nombreAlumno,
  cedularioFijo,
  idsAsignados,
  enviando,
  mostrarErrores,
}: PasoSeleccionProps) {
  const tw = useTranslations('cedularios.seguimiento.asignar.wizard');

  return (
    <div className="flex min-w-0 flex-col gap-[var(--space-md)]">
      {modo === 'alumno' && (
        <>
          {alumnoFijo && <AlumnoBloque alumnoFijo={alumnoFijo} nombre={nombreAlumno} />}
          <div className="flex min-w-0 flex-col gap-1">
            <CedulariosMultiSelector
              value={estado.cedularioIds}
              onChange={(ids) => setEstado((previo) => ({ ...previo, cedularioIds: ids }))}
              idsAsignados={idsAsignados}
              disabled={enviando}
            />
            {mostrarErrores && estado.cedularioIds.length === 0 && (
              <p role="alert" className="text-xs text-[var(--color-error)]">
                {tw('error_elegir_cedulario')}
              </p>
            )}
          </div>
        </>
      )}
      {modo === 'cedulario' && (
        <div className="flex min-w-0 flex-col gap-1">
          <AlumnosSelector
            cedularioId={cedularioFijo?.id}
            value={estado.alumnoIds}
            onChange={(ids) => setEstado((previo) => ({ ...previo, alumnoIds: ids }))}
            disabled={enviando}
          />
          {mostrarErrores && estado.alumnoIds.length === 0 && (
            <p role="alert" className="text-xs text-[var(--color-error)]">
              {tw('error_elegir_alumno')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: materias
// ---------------------------------------------------------------------------

interface PasoMateriasProps {
  modo: ModoWizard;
  estado: EstadoWizard;
  setEstado: SetEstado;
  cedularioActualId: string;
  nombresCedularios: Record<string, string>;
  conAvance: ReadonlySet<string>;
  enviando: boolean;
  mostrarErrores: boolean;
  colapsados: ReadonlySet<string> | undefined;
  onColapsadosChange: (siguiente: ReadonlySet<string>) => void;
  onCapaPropiaChange: (abierta: boolean) => void;
}

export function PasoMaterias({
  modo,
  estado,
  setEstado,
  cedularioActualId,
  nombresCedularios,
  conAvance,
  enviando,
  mostrarErrores,
  colapsados,
  onColapsadosChange,
  onCapaPropiaChange,
}: PasoMateriasProps) {
  const t = useTranslations('cedularios.seguimiento');
  const tw = useTranslations('cedularios.seguimiento.asignar.wizard');
  const totalCedularios = estado.cedularioIds.length;

  return (
    <div className="flex min-w-0 flex-col gap-[var(--space-md)]">
      <div className="flex min-w-0 flex-col gap-2">
        <span className={CLASE_ETIQUETA}>
          {totalCedularios > 1
            ? tw('cedulario_i_de_n', { actual: estado.indiceMaterias + 1, total: totalCedularios })
            : t('asignar.cedulario.etiqueta')}
        </span>
        <div className={CLASE_BLOQUE}>
          <span className="min-w-0 truncate font-medium">
            {nombresCedularios[cedularioActualId] ?? ''}
          </span>
        </div>
      </div>
      <MateriasSelector
        key={cedularioActualId}
        cedularioId={cedularioActualId}
        value={estado.materias[cedularioActualId] ?? 'todas'}
        onChange={(valor: SeleccionMaterias) =>
          setEstado((previo) => ({
            ...previo,
            materias: { ...previo.materias, [cedularioActualId]: valor },
          }))
        }
        conAvance={modo === 'reasignar' ? conAvance : undefined}
        disabled={enviando}
        forzarError={mostrarErrores}
        colapsados={colapsados}
        onColapsadosChange={onColapsadosChange}
        onCapaPropiaChange={onCapaPropiaChange}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: confirm
// ---------------------------------------------------------------------------

interface PasoConfirmarProps {
  modo: ModoWizard;
  estado: EstadoWizard;
  alumnoFijo: AlumnoResumen | null;
  nombreAlumno: string;
  cedularioFijo: CedularioFijo | null;
  nombresCedularios: Record<string, string>;
}

export function PasoConfirmar({
  modo,
  estado,
  alumnoFijo,
  nombreAlumno,
  cedularioFijo,
  nombresCedularios,
}: PasoConfirmarProps) {
  const t = useTranslations('cedularios.seguimiento');
  const tw = useTranslations('cedularios.seguimiento.asignar.wizard');
  const qc = useQueryClient();

  const nombresAlumnosElegidos =
    modo === 'cedulario' && cedularioFijo
      ? nombresDeSeleccionados(qc, cedularioFijo.id, estado.alumnoIds)
      : {};

  const textoMaterias = (id: string): string => {
    const seleccion = estado.materias[id] ?? 'todas';
    return seleccion === 'todas'
      ? tw('todas_las_materias_resumen')
      : tw('materias_elegidas', { count: seleccion.length });
  };

  return (
    <div className="flex min-w-0 flex-col gap-[var(--space-md)]">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{tw('resumen_titulo')}</h3>

      {modo !== 'cedulario' && alumnoFijo && (
        <AlumnoBloque alumnoFijo={alumnoFijo} nombre={nombreAlumno} />
      )}

      {modo === 'cedulario' && (
        <div className="flex min-w-0 flex-col gap-2">
          <span className={CLASE_ETIQUETA}>
            {tw('resumen_alumnos', { count: estado.alumnoIds.length })}
          </span>
          <ul className="flex max-h-40 flex-col divide-y divide-[var(--color-border)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
            {estado.alumnoIds.map((id) => (
              <li key={id} className="px-[var(--space-sm)] py-2 text-sm text-[var(--color-text-primary)]">
                {nombresAlumnosElegidos[id] || t('comun.alumno_sin_nombre')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-2">
        <span className={CLASE_ETIQUETA}>
          {modo === 'alumno'
            ? tw('resumen_cedularios', { count: estado.cedularioIds.length })
            : t('asignar.cedulario.etiqueta')}
        </span>
        <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
          {estado.cedularioIds.map((id) => (
            <li
              key={id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 px-[var(--space-sm)] py-2 text-sm"
            >
              <span className="min-w-0 truncate font-medium text-[var(--color-text-primary)]">
                {nombresCedularios[id] ?? ''}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">{textoMaterias(id)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
