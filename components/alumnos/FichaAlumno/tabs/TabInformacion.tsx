'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Mail, Phone, University, BookOpen, Calendar, CheckCircle2,
  XCircle, FlaskConical, Plus, Trash2, Pencil, X, Save,
  ClipboardList, Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible } from '@/components/common/Collapsible';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Tooltip } from '@/components/common/Tooltip';
import { Button } from '@/components/common/Button';
import { useRouter } from 'next/navigation';
import { toChileTime } from '@/lib/hooks/useServerTime';

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
  const tc = useTranslations('common');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const router = useRouter();
  const qc = useQueryClient();

  const extra = data.alumnos_extra;

  // ── Notas state ──
  const [newNota, setNewNota] = useState('');
  const [addingNota, setAddingNota] = useState(false);
  const [editingNota, setEditingNota] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteNotaId, setDeleteNotaId] = useState<string | null>(null);

  const createNotaMutation = useMutation({
    mutationFn: async (contenido: string) => {
      const res = await fetch(`/api/alumnos/${alumnoId}/notas-alumno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast.success(tf('nota_creada'));
      setNewNota('');
      setAddingNota(false);
      qc.invalidateQueries({ queryKey: ['ficha-alumno', alumnoId] });
    },
    onError: () => toast.error(tf('nota_error_crear')),
  });

  const deleteNotaMutation = useMutation({
    mutationFn: async (notaId: string) => {
      const res = await fetch(`/api/alumnos/${alumnoId}/notas-alumno/${notaId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      toast.success(tf('nota_eliminada'));
      setDeleteNotaId(null);
      qc.invalidateQueries({ queryKey: ['ficha-alumno', alumnoId] });
    },
    onError: () => toast.error(tf('nota_error_eliminar')),
  });

  const updateNotaMutation = useMutation({
    mutationFn: async ({ notaId, contenido }: { notaId: string; contenido: string }) => {
      const res = await fetch(`/api/alumnos/${alumnoId}/notas-alumno/${notaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      toast.success(tf('nota_actualizada'));
      setEditingNota(null);
      qc.invalidateQueries({ queryKey: ['ficha-alumno', alumnoId] });
    },
    onError: () => toast.error(tf('nota_error_actualizar')),
  });

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
  const clasesFuturas = data.historial_clases.filter((c) => {
    const fecha = new Date(`${c.fecha}T${c.hora_inicio}`);
    return fecha >= new Date();
  });

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
          <InfoRow icon={<Mail className="h-4 w-4" />} label={t('email')} value={data.email} />
          {data.telefono && (
            <InfoRow icon={<Phone className="h-4 w-4" />} label={t('telefono')} value={data.telefono} />
          )}
          {extra?.universidad && (
            <InfoRow icon={<University className="h-4 w-4" />} label={t('universidad')} value={extra.universidad} />
          )}
          {extra?.año_ingreso && (
            <InfoRow icon={<BookOpen className="h-4 w-4" />} label={t('año_ingreso')} value={extra.año_ingreso} />
          )}
          {extra?.fecha_prueba && (
            <InfoRow
              icon={<Calendar className="h-4 w-4 text-[var(--color-brand-gold)]" />}
              label={t('fecha_prueba')}
              value={fmtFecha(extra.fecha_prueba)}
              highlight
            />
          )}
          {extra?.ha_dado_examen && (
            <InfoRow
              icon={<Star className="h-4 w-4 text-[var(--color-brand-gold)]" />}
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
      {role !== 'alumno' && <Collapsible
        title={tf('notas_profesor')}
        badge={data.notas_alumno.length}
        icon={<ClipboardList className="h-4 w-4" />}
        defaultOpen={data.notas_alumno.length > 0}
      >
        <div className="space-y-3">
          {data.notas_alumno.length === 0 && !addingNota && (
            <p className="text-sm text-[var(--color-text-muted)]">{tf('sin_notas_profesor')}</p>
          )}

          {data.notas_alumno.map((nota) => (
            <div
              key={nota.id}
              className="group relative rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
            >
              {editingNota === nota.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateNotaMutation.mutate({ notaId: nota.id, contenido: editContent })}
                      loading={updateNotaMutation.isPending}
                    >
                      <Save className="mr-1 h-3 w-3" /> {tc('guardar')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingNota(null)}>
                      <X className="mr-1 h-3 w-3" /> {tc('cancelar')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)] pr-12">{nota.contenido}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {fmtFecha(nota.created_at)}
                      {nota.updated_at !== nota.created_at && ` · ${tf('editada')}`}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] shrink-0">
                      {toChileTime(nota.created_at).slice(0, 5)} hrs
                    </p>
                  </div>
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                    <Tooltip content={tc('editar')} position="top">
                      <button
                        onClick={() => { setEditingNota(nota.id); setEditContent(nota.contenido); }}
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip content={tc('eliminar')} position="top">
                      <button
                        onClick={() => setDeleteNotaId(nota.id)}
                        className="rounded p-1 text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Add nota form */}
          {addingNota ? (
            <div className="space-y-2">
              <textarea
                value={newNota}
                onChange={(e) => setNewNota(e.target.value)}
                rows={3}
                placeholder={tf('nota_placeholder')}
                className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-brand-gold)]/50 bg-[var(--color-bg)] p-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => { if (newNota.trim()) createNotaMutation.mutate(newNota); }}
                  disabled={!newNota.trim()}
                  loading={createNotaMutation.isPending}
                >
                  <Save className="mr-1 h-3 w-3" /> {tc('guardar')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingNota(false); setNewNota(''); }}>
                  <X className="mr-1 h-3 w-3" /> {tc('cancelar')}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNota(true)}
              className="flex items-center gap-1.5 text-sm text-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)]/80 transition-colors"
            >
              <Plus className="h-4 w-4" /> {tf('agregar_nota')}
            </button>
          )}
        </div>
      </Collapsible>}

      {/* ── Clases Recientes (últimas 5 de cualquier estado) ── */}
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
          <Calendar className="h-4 w-4 text-[var(--color-brand-gold)]" />
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
          icon={<CheckCircle2 className="h-4 w-4" />}
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
          icon={<XCircle className="h-4 w-4" />}
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
          icon={<FlaskConical className="h-4 w-4" />}
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
          title={tf('evaluaciones')}
          badge={data.pruebas.length}
          icon={<Star className="h-4 w-4" />}
          defaultOpen={false}
        >
          {data.pruebas.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{tf('sin_evaluaciones')}</p>
          ) : (
            <div className="space-y-2">
              {promedio && (
                <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold-muted)] px-3 py-2">
                  <Star className="h-4 w-4 text-[var(--color-brand-gold)]" />
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

      {/* Delete nota confirm modal */}
      <ConfirmModal
        open={!!deleteNotaId}
        onClose={() => setDeleteNotaId(null)}
        onConfirm={() => { if (deleteNotaId) deleteNotaMutation.mutate(deleteNotaId); }}
        title={tf('confirmar_eliminar_nota')}
        description={tf('confirmar_eliminar_nota_desc')}
        confirmText={tc('eliminar')}
        cancelText={tc('cancelar')}
        loading={deleteNotaMutation.isPending}
        isDanger
      />
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
