'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { useUserStore } from '@/stores/useUserStore';
import { variablesDisponibles } from '@/lib/email/variables';
import { TIPOS_CORREO, type TipoCorreo } from '@/lib/validations/emailPlantilla.schema';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Save, Loader2, RotateCcw, Braces, Lock, Code, Eye,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlantillaItem {
  tipo: TipoCorreo;
  personalizada: boolean;
  asunto: string;
  cuerpo_html: string;
  max_caracteres_nota: number | null;
}

interface PlantillasResponse {
  plantillas: PlantillaItem[];
}

interface PerfilLite {
  rol?: string;
  email_disponible?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls = cn(
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
  'bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text-primary)]',
  'placeholder:text-[var(--color-text-muted)]',
  'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]',
  'transition-colors',
);

/**
 * Deriva la subclave i18n relativa al namespace `plantillasCorreo` a partir de la
 * `claveDescripcion` completa (p.ej. `plantillasCorreo.variables.hora_inicio` →
 * `variables.hora_inicio`), para usarla con `useTranslations('plantillasCorreo')`.
 */
function subclaveDescripcion(claveDescripcion: string): string {
  return claveDescripcion.replace(/^plantillasCorreo\./, '');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlantillasCorreoPage() {
  const { user } = useUserStore();
  const queryClient = useQueryClient();
  const tp = useTranslations('plantillasCorreo');
  const router = useRouter();
  const pathname = usePathname();

  // Determine back path: if accessed from /pagina/*, go back to /pagina
  const backPath = pathname.startsWith('/pagina') ? '/pagina' : '/perfil';

  // ── Datos: disponibilidad de correo (perfil) y plantillas ─────────────────
  const { data: perfilData, isLoading: perfilLoading } = useQuery<PerfilLite>({
    queryKey: ['perfil'],
    queryFn: async () => {
      const res = await fetch('/api/perfil');
      if (!res.ok) throw new Error('Error al cargar perfil');
      return res.json();
    },
    staleTime: 0,
  });

  const { data: plantillasData, isLoading: plantillasLoading } = useQuery<PlantillasResponse>({
    queryKey: ['email-plantillas'],
    queryFn: async () => {
      const res = await fetch('/api/email/plantillas');
      if (!res.ok) throw new Error('Error al cargar plantillas');
      return res.json();
    },
    staleTime: 0,
  });

  // ── Estado editable ───────────────────────────────────────────────────────
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoCorreo>(TIPOS_CORREO[0]);
  const [asunto, setAsunto] = useState('');
  const [cuerpoHtml, setCuerpoHtml] = useState('');
  const [maxCaracteresNota, setMaxCaracteresNota] = useState<number | null>(null);
  // Modo del campo de cuerpo: inicia en edición (Requisito 17.2). Alternar no muta `cuerpoHtml` (Requisito 17.4).
  const [modoCuerpo, setModoCuerpo] = useState<'editor' | 'preview'>('editor');

  // ── Seguimiento del campo activo para insertar variables en el cursor ─────
  const asuntoRef = useRef<HTMLInputElement>(null);
  const cuerpoRef = useRef<HTMLTextAreaElement>(null);
  const activeFieldRef = useRef<'asunto' | 'cuerpo'>('cuerpo');

  const plantillaActual = plantillasData?.plantillas.find((p) => p.tipo === tipoSeleccionado);

  // Precargar el contenido editable cuando cambia el tipo o llegan/cambian los datos.
  useEffect(() => {
    if (plantillaActual) {
      setAsunto(plantillaActual.asunto);
      setCuerpoHtml(plantillaActual.cuerpo_html);
      setMaxCaracteresNota(plantillaActual.max_caracteres_nota);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoSeleccionado, plantillaActual?.asunto, plantillaActual?.cuerpo_html, plantillaActual?.max_caracteres_nota]);

  // ── Inserción de variables en la posición del cursor del campo activo ─────
  function insertarToken(token: string) {
    const field = activeFieldRef.current;
    const el = field === 'asunto' ? asuntoRef.current : cuerpoRef.current;
    const valorActual = field === 'asunto' ? asunto : cuerpoHtml;
    const setValor = field === 'asunto' ? setAsunto : setCuerpoHtml;

    let start = valorActual.length;
    let end = valorActual.length;
    if (el && el.selectionStart != null) {
      start = el.selectionStart;
      end = el.selectionEnd ?? start;
    }

    const nuevoValor = valorActual.slice(0, start) + token + valorActual.slice(end);
    setValor(nuevoValor);

    const nuevaPos = start + token.length;
    // Reposicionar el cursor tras el re-render del valor controlado.
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(nuevaPos, nuevaPos);
      }
    });
  }

  // ── Mutaciones ────────────────────────────────────────────────────────────
  const guardarMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { asunto, cuerpo_html: cuerpoHtml };
      // Solo enviar max_caracteres_nota si es el tipo nueva_nota_clase
      if (tipoSeleccionado === 'nueva_nota_clase') {
        payload.max_caracteres_nota = maxCaracteresNota;
      }
      const res = await fetch(`/api/email/plantillas/${tipoSeleccionado}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Error al guardar la plantilla');
      return res.json();
    },
    onSuccess: () => {
      toast.success(tp('toast_guardado'));
      queryClient.invalidateQueries({ queryKey: ['email-plantillas'] });
    },
    onError: () => toast.error(tp('toast_error')),
  });

  const restablecerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/email/plantillas/${tipoSeleccionado}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al restablecer la plantilla');
      return res.json();
    },
    onSuccess: () => {
      toast.success(tp('toast_restablecido'));
      queryClient.invalidateQueries({ queryKey: ['email-plantillas'] });
    },
    onError: () => toast.error(tp('toast_error')),
  });

  function handleGuardar() {
    if (!asunto.trim()) {
      toast.error(tp('validacion_asunto_vacio'));
      return;
    }
    if (!cuerpoHtml.trim()) {
      toast.error(tp('validacion_cuerpo_vacio'));
      return;
    }
    guardarMutation.mutate();
  }

  // ── Guard de acceso ───────────────────────────────────────────────────────
  const rol = perfilData?.rol ?? user?.rol;
  const isAlumno = rol === 'alumno';
  const emailNoDisponible = perfilData?.email_disponible === false;
  const isLoading = perfilLoading || plantillasLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-[var(--color-brand-gold)]" />
        <span className="sr-only">{tp('cargando')}</span>
      </div>
    );
  }

  // Alumno o correo no disponible → denegar acceso (Requisito 6.4, 6.5).
  if (isAlumno || emailNoDisponible) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-text-muted)_12%,transparent)]">
          <Lock className="size-6 text-[var(--color-text-muted)]" />
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">{tp('sin_acceso')}</p>
        <button
          onClick={() => router.push(backPath)}
          className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <ArrowLeft className="size-4" />
          {tp('volver')}
        </button>
      </div>
    );
  }

  const variables = variablesDisponibles(tipoSeleccionado);
  const isMutating = guardarMutation.isPending || restablecerMutation.isPending;

  return (
    <div className="space-y-8">
      {/* ── Encabezado ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(backPath)}
          aria-label={tp('volver')}
          className="flex size-9 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
            {tp('titulo')}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{tp('subtitulo')}</p>
        </div>
      </div>

      {/* ── Selector de tipo de correo ───────────────────────────────────── */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{tp('tipo_label')}</span>
        <div className="flex flex-wrap gap-2">
          {TIPOS_CORREO.map((tipo) => {
            const activo = tipo === tipoSeleccionado;
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => setTipoSeleccionado(tipo)}
                aria-pressed={activo}
                className={cn(
                  'rounded-[var(--radius-sm)] border px-3.5 py-2 text-sm font-medium transition-colors',
                  activo
                    ? 'border-[var(--color-brand-gold)] bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)] text-[var(--color-text-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
                )}
              >
                {tp(`tipos.${tipo}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
        {/* ── Campos de edición ──────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="plantilla-asunto" className="text-sm font-medium text-[var(--color-text-primary)]">
              {tp('asunto_label')}
            </label>
            <input
              id="plantilla-asunto"
              ref={asuntoRef}
              type="text"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              onFocus={() => { activeFieldRef.current = 'asunto'; }}
              placeholder={tp('asunto_placeholder')}
              maxLength={200}
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="plantilla-cuerpo" className="text-sm font-medium text-[var(--color-text-primary)]">
                {tp('cuerpo_label')}
              </label>
              {/* Toggle Modo_Edicion / Modo_Vista_Previa (Requisito 17.1, 17.5) */}
              <div role="group" aria-label={tp('cuerpo.modoLabel')} className="flex gap-1">
                <button
                  type="button"
                  aria-pressed={modoCuerpo === 'editor'}
                  onClick={() => setModoCuerpo('editor')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-1 text-xs font-medium transition-colors',
                    modoCuerpo === 'editor'
                      ? 'border-[var(--color-brand-gold)] bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)] text-[var(--color-text-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
                  )}
                >
                  <Code className="size-3.5" />
                  {tp('cuerpo.modoEditor')}
                </button>
                <button
                  type="button"
                  aria-pressed={modoCuerpo === 'preview'}
                  onClick={() => setModoCuerpo('preview')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-1 text-xs font-medium transition-colors',
                    modoCuerpo === 'preview'
                      ? 'border-[var(--color-brand-gold)] bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)] text-[var(--color-text-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
                  )}
                >
                  <Eye className="size-3.5" />
                  {tp('cuerpo.modoPreview')}
                </button>
              </div>
            </div>
            {modoCuerpo === 'editor' ? (
              <textarea
                id="plantilla-cuerpo"
                ref={cuerpoRef}
                value={cuerpoHtml}
                onChange={(e) => setCuerpoHtml(e.target.value)}
                onFocus={() => { activeFieldRef.current = 'cuerpo'; }}
                placeholder={tp('cuerpo_placeholder')}
                rows={14}
                className={cn(inputCls, 'resize-y font-mono leading-relaxed')}
              />
            ) : (
              // Modo_Vista_Previa: renderiza el mismo HTML que se enviará (Requisito 17.3).
              <div
                className={cn(
                  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-4 py-3 overflow-auto',
                  'min-h-[20rem]',
                )}
                dangerouslySetInnerHTML={{ __html: cuerpoHtml }}
              />
            )}
          </div>

          {/* ── Config. truncado nota (solo para nueva_nota_clase) ─────── */}
          {tipoSeleccionado === 'nueva_nota_clase' && (
            <div className="space-y-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
              <label htmlFor="max-caracteres-nota" className="text-sm font-medium text-[var(--color-text-primary)]">
                {tp('max_caracteres_nota_label')}
              </label>
              <p className="text-xs text-[var(--color-text-muted)]">
                {tp('max_caracteres_nota_help')}
              </p>
              <input
                id="max-caracteres-nota"
                type="number"
                min={0}
                value={maxCaracteresNota ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setMaxCaracteresNota(val === '' ? null : parseInt(val, 10));
                }}
                placeholder="600"
                className={cn(inputCls, 'max-w-[200px]')}
              />
            </div>
          )}

          {/* ── Acciones ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => restablecerMutation.mutate()}
              disabled={isMutating}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50 transition-colors"
            >
              {restablecerMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              {tp('restablecer')}
            </button>

            <button
              type="button"
              onClick={handleGuardar}
              disabled={isMutating}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {guardarMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {tp('guardar')}
            </button>
          </div>
        </div>

        {/* ── Panel de variables dinámicas ───────────────────────────────── */}
        <aside className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)]">
              <Braces className="size-4 text-[var(--color-brand-gold)]" />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{tp('variables_titulo')}</h2>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">{tp('variables_instruccion')}</p>

          <div className="space-y-2">
            {variables.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => insertarToken(v.token)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-left hover:border-[var(--color-brand-gold)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <span className="block font-mono text-sm text-[var(--color-brand-gold)]">{v.token}</span>
                <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                  {tp(subclaveDescripcion(v.claveDescripcion))}
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
