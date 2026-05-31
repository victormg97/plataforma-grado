'use client';

import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import {
  Mail, Phone, University, BookOpen, Calendar, CheckCircle2,
  XCircle, FlaskConical, Star,
} from 'lucide-react';
import { Collapsible } from '@/components/common/Collapsible';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useRouter } from 'next/navigation';
import { usePruebaTerm } from '@/lib/hooks/usePruebaTerm';
import { NotasProfesorSection } from './NotasProfesorSection';

interface NotaAlumno {
  id: string;
  contenido: string;
  created_at: string;
  updated_at: string;
  autor?: { id: string; nombre: string; apellido: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Clase = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Prueba = Record<string, any>;

interface TabInformacionProps {
  alumnoId: string;
  data: {
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string | null;
    avatar_url?: string | null;
    alumnos_extra?: {
      universidad?: string | null;
      año_ingreso?: string | null;
      año_egreso?: string | null;
      fecha_prueba?: string | null;
      ha_dado_examen?: boolean | null;
      intentos_prueba?: number | null;
    } | null;
    notas_alumno: NotaAlumno[];
    historial_clases: Clase[];
    pruebas: Prueba[];
    ficha_stats?: {
      total_clases: number;
      confirmadas: number;
      canceladas: number;
      tasa_asistencia: number;
    } | null;
  };
  /** Caller role context: 'profesor' | 'admin' | 'alumno' — used for nav links and visibility */
  role?: 'profesor' | 'admin' | 'alumno';
}

export function TabInformacion({ alumnoId, data, role = 'profesor' }: TabInformacionProps) {
  const t = useTranslations('alumnos');
  const tf = useTranslations('ficha');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const router = useRouter();
  const pruebaTerm = usePruebaTerm();

  const extra = data.alumnos_extra;

  // ── Clasificar clases ──
  const clasesPasadas = data.historial_clases.filter((c) => {
    const fecha = new Date(`${c.fecha}T${c.hora_fin}`);
    return fecha < new Date();
  });
  const clasesConfirmadas = clasesPasadas.filter(
    (c) => c.asistencia?.[0]?.estado === 'confirmado'
  );
  const clasesCanceladas = clasesPasadas.filter(
    (c) => c.asistencia?.[0]?.estado === 'cancelado'
  );
  const clasesPrueba = data.historial_clases.filter((c) => c.from_programa);

  // ── Promedio de notas de pruebas ──
  const pruebasCalificadas = data.pruebas.filter(
    (p) => p.estado === 'calificada' && p.nota != null
  );
  const promedio =
    pruebasCalificadas.length > 0
      ? (
        pruebasCalificadas.reduce((acc: number, p: Prueba) => acc + Number(p.nota), 0) /
        pruebasCalificadas.length
      ).toFixed(1)
      : null;

  const fmtFecha = (fecha: string) =>
    format(new Date(fecha), locale === 'en' ? 'MMM d, yyyy' : 'd MMM yyyy', { locale: dateFnsLocale });
  const fmtHora = (h: string) => h.slice(0, 5);

  const claseDetailPath = (claseId: string) =>
    role === 'admin'
      ? `/admin/clase/${claseId}`
      : role === 'alumno'
        ? `/alumno/horario?id=${claseId}&from=/alumno/perfil`
        : `/profesor/clase/${claseId}`;

  return (
    <div className="space-y-5">
      {/* ── Datos personales ── */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {tf('datos_personales')}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow icon={<Mail className="size-4" />} label={t('email')} value={data.email} />
          {data.telefono && (
            <InfoRow icon={<Phone className="size-4" />} label={t('telefono')} value={data.telefono} />
          )}
          {extra?.universidad && (
            <InfoRow icon={<University className="size-4" />} label={t('universidad')} value={extra.universidad} />
          )}
          {extra?.año_ingreso && (
            <InfoRow icon={<BookOpen className="size-4" />} label={t('año_ingreso')} value={extra.año_ingreso} />
          )}
          {extra?.año_egreso && (
            <InfoRow icon={<BookOpen className="size-4" />} label={t('año_egreso')} value={extra.año_egreso} />
          )}
          {extra?.fecha_prueba && (
            <InfoRow
              icon={<Calendar className="size-4 text-[var(--color-brand-gold)]" />}
              label={t('fecha_prueba')}
              value={fmtFecha(extra.fecha_prueba)}
              highlight
            />
          )}
          {extra?.ha_dado_examen && (
            <InfoRow
              icon={<Star className="size-4 text-[var(--color-brand-gold)]" />}
              label={tf('ha_intentado_examen')}
              value={
                extra.intentos_prueba != null && extra.intentos_prueba > 0
                  ? tf('intentos_count', { count: extra.intentos_prueba })
                  : '\u2714'
              }
            />
          )}
        </div>
      </section>

      {/* ── Stats rápidos ── */}
      {data.ficha_stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={tf('stat_total')} value={data.ficha_stats.total_clases} />
          <StatCard label={tf('stat_confirmadas')} value={data.ficha_stats.confirmadas} color="success" />
          <StatCard label={tf('stat_canceladas')} value={data.ficha_stats.canceladas} color="error" />
          <StatCard label={tf('stat_asistencia')} value={`${data.ficha_stats.tasa_asistencia}%`} color="gold" />
        </div>
      )}

      {/* ── Notas del profesor (hidden for alumno self-view) ── */}
      {role !== 'alumno' && (
        <NotasProfesorSection
          alumnoId={alumnoId}
          notas={data.notas_alumno}
          fmtFecha={fmtFecha}
        />
      )}

      {/* ── Clases Recientes (últimas 5 de cualquier estado) ── */}
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
          <Calendar className="size-4 text-[var(--color-brand-gold)]" />
          {tf('clases_recientes')}
        </h3>
        {data.historial_clases.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">{tf('sin_clases')}</p>
        ) : (
          <div className="space-y-1.5">
            {data.historial_clases.slice(0, 5).map((c) => (
              <ClaseRow
                key={c.id}
                clase={c}
                fmtFecha={fmtFecha}
                fmtHora={fmtHora}
                onClick={() => router.push(claseDetailPath(c.id))}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Secciones de Historial (aparecen cerradas por defecto y muestran conteo) ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {tf('historial_completo')}
        </h3>

        {/* Clases confirmadas */}
        <Collapsible
          title={tf('clases_confirmadas')}
          badge={clasesConfirmadas.length}
          icon={<CheckCircle2 className="size-4" />}
          defaultOpen={false}
        >
          {clasesConfirmadas.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{tf('sin_clases_confirmadas')}</p>
          ) : (
            <div className="space-y-1.5">
              {clasesConfirmadas.map((c) => (
                <ClaseRow
                  key={c.id}
                  clase={c}
                  fmtFecha={fmtFecha}
                  fmtHora={fmtHora}
                  onClick={() => router.push(claseDetailPath(c.id))}
                />
              ))}
            </div>
          )}
        </Collapsible>

        {/* Clases canceladas */}
        <Collapsible
          title={tf('clases_canceladas')}
          badge={clasesCanceladas.length}
          icon={<XCircle className="size-4" />}
          defaultOpen={false}
        >
          {clasesCanceladas.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{tf('sin_clases_canceladas')}</p>
          ) : (
            <div className="space-y-1.5">
              {clasesCanceladas.map((c) => (
                <ClaseRow
                  key={c.id}
                  clase={c}
                  fmtFecha={fmtFecha}
                  fmtHora={fmtHora}
                  onClick={() => router.push(claseDetailPath(c.id))}
                />
              ))}
            </div>
          )}
        </Collapsible>

        {/* Pruebas del curso (clases de programa) */}
        <Collapsible
          title={tf('clases_con_prueba')}
          badge={clasesPrueba.length}
          icon={<FlaskConical className="size-4" />}
          defaultOpen={false}
        >
          {clasesPrueba.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{tf('sin_clases_prueba')}</p>
          ) : (
            <div className="space-y-1.5">
              {clasesPrueba.map((c) => (
                <ClaseRow
                  key={c.id}
                  clase={c}
                  fmtFecha={fmtFecha}
                  fmtHora={fmtHora}
                  onClick={() => router.push(claseDetailPath(c.id))}
                />
              ))}
            </div>
          )}
        </Collapsible>

        {/* Evaluaciones / Calificaciones de pruebas app */}
        <Collapsible
          title={tf('evaluaciones', { term: pruebaTerm.plural })}
          badge={data.pruebas.length}
          icon={<Star className="size-4" />}
          defaultOpen={false}
        >
          {data.pruebas.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{tf('sin_evaluaciones')}</p>
          ) : (
            <div className="space-y-2">
              {promedio && (
                <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold-muted)] px-3 py-2">
                  <Star className="size-4 text-[var(--color-brand-gold)]" />
                  <span className="text-sm font-semibold text-[var(--color-brand-gold)]">
                    {tf('promedio_notas')}: {promedio}
                  </span>
                </div>
              )}
              {data.pruebas.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{p.nombre}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{fmtFecha(p.fecha)}</p>
                  </div>
                  <div className="text-right">
                    {p.nota != null ? (
                      <span className="text-lg font-bold text-[var(--color-brand-gold)]">{p.nota}</span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">{tf('sin_nota')}</span>
                    )}
                    <StatusBadge status={p.estado} className="ml-2" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Collapsible>
      </div>

    </div>
  );
}

// ── Helper components ──

function InfoRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-start gap-2.5 rounded-[var(--radius-sm)] p-2.5 ${highlight ? 'bg-[var(--color-brand-gold-muted)]' : 'bg-[var(--color-bg-secondary)]'}`}>
      <span className={`mt-0.5 shrink-0 ${highlight ? 'text-[var(--color-brand-gold)]' : 'text-[var(--color-text-muted)]'}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{value}</p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: 'success' | 'error' | 'gold';
}) {
  const colorMap = {
    success: 'text-[var(--color-success)]',
    error: 'text-[var(--color-error)]',
    gold: 'text-[var(--color-brand-gold)]',
  };
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center">
      <p className={`text-2xl font-bold ${color ? colorMap[color] : 'text-[var(--color-text-primary)]'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

function ClaseRow({
  clase,
  fmtFecha,
  fmtHora,
  onClick,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clase: Record<string, any>;
  fmtFecha: (s: string) => string;
  fmtHora: (s: string) => string;
  onClick?: () => void;
}) {
  const estado = clase.asistencia?.[0]?.estado ?? 'pendiente';
  return (
    <button
      onClick={onClick}
      type="button"
      className="flex w-full items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm transition-colors hover:bg-[var(--color-bg-elevated)] cursor-pointer text-left"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--color-text-primary)]">{clase.titulo}</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {fmtFecha(clase.fecha)} · {fmtHora(clase.hora_inicio)}
        </p>
      </div>
      <StatusBadge status={estado} className="ml-2 shrink-0" />
    </button>
  );
}
