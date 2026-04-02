'use client';

import { use, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, BookOpen, Calendar, CheckCircle2, Clock, XCircle, FileSignature, Award, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale } from 'next-intl';
import { buildAlumnoHorarioDetailHref } from '@/lib/utils/horarioNavigation';

type AlumnoProgramaData = {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
  profesor: { id: string; nombre: string; apellido: string; avatar_url: string | null } | null;
  asignado_el: string;
  clases_programadas: Array<{
    id: string;
    nombre: string;
    tipo: 'materia' | 'prueba';
    orden: number;
    duracion_min: number | null;
    horario: {
      id: string;
      fecha: string;
      hora_inicio: string;
      hora_fin: string;
      activo: boolean;
      asistencia_estado: 'pendiente' | 'confirmado' | 'cancelado' | 'cambiado' | 'no_asistio';
    } | null;
    prueba: {
      id: string;
      nombre: string;
      fecha: string;
      nota: number | null;
      observaciones: string | null;
      estado: 'pendiente' | 'realizada' | 'ausente';
    } | null;
  }>;
};

async function fetchAlumnoPrograma(id: string): Promise<AlumnoProgramaData> {
  const res = await fetch(`/api/alumnos/programas/${id}`);
  if (!res.ok) throw new Error('Error al cargar el programa');
  return res.json();
}

export default function AlumnoProgramaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const t = useTranslations('programas');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;

  const currentPath = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);
  
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    const channel = supabase
      .channel('alumno-programa-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios' }, () => {
        queryClient.invalidateQueries({ queryKey: ['alumno_programa', id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, () => {
        queryClient.invalidateQueries({ queryKey: ['alumno_programa', id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pruebas' }, () => {
        queryClient.invalidateQueries({ queryKey: ['alumno_programa', id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const { data: programa, isLoading, error } = useQuery({
    queryKey: ['alumno_programa', id],
    queryFn: () => fetchAlumnoPrograma(id),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand-gold)] border-t-transparent" />
      </div>
    );
  }

  if (error || !programa) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="mb-4 h-12 w-12 text-[var(--color-error)]" />
        <h2 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">
          {t('mensajes.error_cargar_titular')}
        </h2>
        <p className="mb-6 text-[var(--color-text-muted)]">
          {t('mensajes.error_cargar_desc')}
        </p>
        <button
          onClick={() => router.back()}
          className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-border)]"
        >
          {t('volver')}
        </button>
      </div>
    );
  }

  const handleBack = () => {
    const from = searchParams.get('from');
    if (from) {
      router.push(from);
    } else {
      router.back();
    }
  };

  const getStatusColorAndIcon = (horario: AlumnoProgramaData['clases_programadas'][0]['horario']) => {
    if (!horario) return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500', icon: Clock };
    switch (horario.asistencia_estado) {
      case 'confirmado':
        return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: CheckCircle2 };
      case 'cancelado':
      case 'no_asistio':
        return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: XCircle };
      case 'cambiado':
        return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: Clock };
      case 'pendiente':
      default:
        return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', icon: Clock };
    }
  };

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <div className="mb-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('volver')}
        </button>
      </div>

      <PageHeader
        title={programa.nombre}
        subtitle={programa.descripcion ?? t('sin_descripcion')}
      />

      {(() => {
        const clases = programa.clases_programadas || [];
        const isFinished = clases.length > 0 && clases.every(c => c.horario?.asistencia_estado === 'confirmado');
        if (!isFinished) return null;
        return (
          <div className="mb-6 rounded-[var(--radius-lg)] border border-green-500/20 bg-green-500/10 p-4 dark:border-green-400/20 dark:bg-green-400/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-600 dark:bg-green-400/20 dark:text-green-400">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">
                  {t('alumno_vista.programa_completado')}
                </h3>
                <p className="mt-0.5 text-xs text-green-700/80 dark:text-green-400/80">
                  {t('alumno_vista.programa_completado_desc')}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {programa.profesor && (
        <Card className="mt-[var(--space-md)] mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border border-[var(--color-brand-gold)]/20 shadow-sm bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-bg-secondary)]">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-semibold mb-1">
              {t('alumno_vista.profesor_asignado')}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold)] border border-[var(--color-brand-gold-muted)] text-[var(--color-brand-black)] font-bold shadow-sm">
                {programa.profesor.nombre?.[0]?.toUpperCase() ?? '?'}
              </div>
              <p className="text-lg font-medium text-[var(--color-text-primary)]">
                {programa.profesor.nombre} {programa.profesor.apellido}
              </p>
            </div>
          </div>
          <div className="mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5 line-clamp-1">
               <Calendar className="h-3.5 w-3.5" />
               {t('alumno_vista.asignado_el', { fecha: format(new Date(programa.asignado_el), "d 'de' MMMM, yyyy", { locale: dateFnsLocale }) })}
            </p>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[var(--color-brand-gold)]" />
          {t('clases_del_programa')}
        </h3>

        <div className="grid grid-cols-1 gap-3">
          {programa.clases_programadas?.map((clase, idx) => {
             const style = getStatusColorAndIcon(clase.horario);
             const StatusIcon = style.icon;

             const href = clase.horario ? buildAlumnoHorarioDetailHref(clase.horario.id, currentPath) : undefined;
             const cardContent = (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  {/* Badge Number */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] font-bold border shadow-sm ${style.bg} ${style.text} ${clase.horario ? 'border-current/20' : 'border-[var(--color-border)]'}`}>
                    {idx + 1}
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)] text-base group-hover:text-[var(--color-brand-gold)] transition-colors">
                      {clase.nombre}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {clase.tipo === 'prueba' ? (
                        <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium">
                          <FileSignature className="h-3 w-3" />
                          {t('alumno_vista.examen')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[var(--color-text-secondary)] font-medium">
                          <BookOpen className="h-3 w-3" />
                          {t('alumno_vista.materia')}
                        </span>
                      )}
                      {clase.duracion_min && (
                        <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
                          <Clock className="h-3 w-3" />
                          {clase.duracion_min} min
                        </span>
                      )}
                      {clase.horario?.asistencia_estado === 'pendiente' && (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-600 font-medium dark:text-amber-400">
                          <AlertCircle className="h-3 w-3" />
                          {t('alumno_vista.requiere_confirmacion')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Scheduling and Grades */}
                <div className="flex flex-col gap-2 sm:items-end">
                    {clase.horario ? (
                      <div className="flex items-center gap-2">
                         <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {format(new Date(clase.horario.fecha + 'T12:00:00'), "E d MMM", { locale: dateFnsLocale })}
                            {' • '}
                            {clase.horario.hora_inicio.slice(0, 5)}
                         </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 italic text-[var(--color-text-muted)]">
                        {t('alumno_vista.no_programado')}
                      </span>
                    )}

                    {clase.tipo === 'prueba' && clase.prueba && (
                      <div className="flex items-center gap-2 sm:justify-end">
                        {clase.prueba.nota !== null ? (
                          <span className={`text-base font-bold ${Number(clase.prueba.nota) >= 4 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            {t('alumno_vista.nota', { nota: Number(clase.prueba.nota).toFixed(1) })}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-md px-2 py-1">
                            {t('alumno_vista.sin_calificar')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
             );

             return href ? (
               <Link key={clase.id} href={href} className="block group">
                 <Card className="p-4 transition-all hover:border-[var(--color-brand-gold-muted)] hover:shadow-md h-full relative overflow-hidden cursor-pointer">
                   {cardContent}
                 </Card>
               </Link>
             ) : (
               <Card key={clase.id} className="p-4 relative overflow-hidden opacity-75">
                 {cardContent}
               </Card>
             );
          })}

          {!programa.clases_programadas?.length && (
            <div className="py-8 text-center text-sm text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-lg">
              {t('alumno_vista.sin_contenido')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
