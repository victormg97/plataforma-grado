/**
 * Rutas `PATCH` y `DELETE` de `/api/agenda/actividades/[id]`.
 *
 * Punto de composición: orquesta el slice `visibilidad` (resolución de contexto),
 * el slice `actividades` (validación + persistencia) y el slice `notificaciones`
 * (envío post-respuesta). No contiene lógica de negocio propia (Req 17.8, 17.11).
 *
 * Requisitos cubiertos: 4.2, 4.3, 4.6, 4.12, 4.13, 4.14, 4.15, 5.2, 6.8, 7.7,
 * 13.2, 13.3, 13.4, 13.9, 13.14, 13.15, 13.16, 13.17, 14.10, 14.11, 14.12,
 * 14.14, 17.5, 17.11.
 */
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { desdeZod, respuestaError } from '@/lib/agenda/compartido';
import { resolverContextoLector } from '@/lib/agenda/visibilidad';
import { leerEventoPorId } from '@/lib/agenda/nucleo';
import {
  editarActividadSchema,
  editarActividad,
  eliminarActividad,
  cambiaronCamposNotificables,
  resolverDestinatariosVigentes,
} from '@/lib/agenda/actividades';
import { notificarActividad } from '@/lib/agenda/notificaciones';
import type { AgendaEvento } from '@/lib/supabase/types';

// ─── PATCH ──────────────────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ── 1. Cliente SSR ligado a la sesión (nunca Clave_Servicio, Req 14.14) ───
  const cliente = await createClient();

  // ── 2. Resolver contexto del lector (Req 14.10) ───────────────────────────
  const contexto = await resolverContextoLector(cliente);
  if (!contexto.ok) return respuestaError(contexto.error);

  // ── 3. Validar cuerpo con Zod (Req 4.3, 4.6) ─────────────────────────────
  const cuerpo = editarActividadSchema.safeParse(await request.json());
  if (!cuerpo.success) {
    return respuestaError(
      desdeZod(cuerpo.error, { namespace: 'agendaActividades' }),
    );
  }

  // ── 4. Leer evento anterior para diff de campos notificables (Req 13.16) ──
  const eventoAnterior = await leerEventoPorId(cliente, id);

  // ── 5. Servicio (Req 4.12, 4.14, 4.15, 14.12) ────────────────────────────
  const resultado = await editarActividad(cliente, contexto.valor, id, cuerpo.data);
  if (!resultado.ok) return respuestaError(resultado.error);

  // ── 6. Notificaciones si cambiaron campos notificables (Req 13.15, 13.16) ─
  let correoIntentado = false;

  if (
    eventoAnterior &&
    cambiaronCamposNotificables(eventoAnterior, resultado.valor.evento)
  ) {
    correoIntentado = true;

    // Resolver destinatarios vigentes en este momento (Req 13.4)
    const destinatarios = await resolverDestinatariosVigentes(cliente, {
      id: resultado.valor.evento.id,
      alcance: resultado.valor.evento.alcance as 'alumnos_seleccionados' | 'todos_alumnos',
      autorId: contexto.valor.id,
      autorRol: contexto.valor.rol,
    });

    // Query al perfil del autor para nombre, apellido y enviar_correo_al_asignar
    const { data: perfilAutor } = await cliente
      .from('profiles')
      .select('nombre, apellido, enviar_correo_al_asignar')
      .eq('id', contexto.valor.id)
      .single();

    // after() de Next.js encola el trabajo post-respuesta (Req 13.14)
    after(async () => {
      await notificarActividad({
        actividad: resultado.valor.evento as unknown as AgendaEvento,
        destinatarios,
        autor: {
          id: contexto.valor.id,
          nombre: perfilAutor?.nombre ?? '',
          apellido: perfilAutor?.apellido ?? '',
          enviarCorreoAlAsignar: perfilAutor?.enviar_correo_al_asignar ?? false,
        },
        operacion: 'edicion',
      });
    });
  }

  // ── 7. Respuesta 200 con advertencias ─────────────────────────────────────
  return Response.json(
    { data: resultado.valor.evento, advertencias: resultado.valor.advertencias, correo_intentado: correoIntentado },
    { status: 200 },
  );
}

// ─── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ── 1. Cliente SSR ligado a la sesión (nunca Clave_Servicio, Req 14.14) ───
  const cliente = await createClient();

  // ── 2. Resolver contexto del lector (Req 14.10) ───────────────────────────
  const contexto = await resolverContextoLector(cliente);
  if (!contexto.ok) return respuestaError(contexto.error);

  // ── 3. Servicio — no notifica (Req 13.17). Registros_Envio se conservan. ──
  const resultado = await eliminarActividad(cliente, contexto.valor, id);
  if (!resultado.ok) return respuestaError(resultado.error);

  // ── 4. Respuesta 200 ─────────────────────────────────────────────────────
  return Response.json(
    { data: { id }, advertencias: [] },
    { status: 200 },
  );
}
