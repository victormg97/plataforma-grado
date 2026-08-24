/**
 * Ruta `POST /api/agenda/actividades` — creación de Actividad.
 *
 * Punto de composición: orquesta el slice `visibilidad` (resolución de contexto),
 * el slice `actividades` (validación + persistencia) y el slice `notificaciones`
 * (envío post-respuesta). No contiene lógica de negocio propia (Req 17.8, 17.11).
 *
 * Requisitos cubiertos: 4.2, 4.3, 4.6, 4.12, 4.13, 4.14, 4.15, 5.2, 6.8, 7.7,
 * 13.2, 13.3, 13.4, 13.9, 13.14, 14.10, 14.11, 14.12, 14.14, 17.5, 17.11.
 */
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { desdeZod, respuestaError } from '@/lib/agenda/compartido';
import { resolverContextoLector } from '@/lib/agenda/visibilidad';
import {
  crearActividadSchema,
  crearActividad,
  resolverDestinatariosVigentes,
} from '@/lib/agenda/actividades';
import { notificarActividad } from '@/lib/agenda/notificaciones';
import type { AgendaEvento } from '@/lib/supabase/types';

export async function POST(request: Request) {
  // ── 1. Cliente SSR ligado a la sesión (nunca Clave_Servicio, Req 14.14) ───
  const cliente = await createClient();

  // ── 2. Resolver contexto del lector (Req 14.10) ───────────────────────────
  const contexto = await resolverContextoLector(cliente);
  if (!contexto.ok) return respuestaError(contexto.error);

  // ── 3. Validar cuerpo con Zod (Req 4.2, 4.3, 4.6) ────────────────────────
  const cuerpo = crearActividadSchema.safeParse(await request.json());
  if (!cuerpo.success) {
    return respuestaError(
      desdeZod(cuerpo.error, { namespace: 'agendaActividades' }),
    );
  }

  // ── 4. Servicio (Req 5.2, 4.12, 14.12) ───────────────────────────────────
  const resultado = await crearActividad(cliente, contexto.valor, cuerpo.data);
  if (!resultado.ok) return respuestaError(resultado.error);

  // ── 5. Notificaciones — resolución de destinatarios y encadenamiento ──────
  // Requisitos 13.2, 13.3, 13.4, 13.9, 13.14, 17.5.
  // Se resuelven los destinatarios UNA sola vez tras persistir (Req 13.4).
  const destinatarios = await resolverDestinatariosVigentes(cliente, {
    id: resultado.valor.evento.id,
    alcance: cuerpo.data.alcance,
    autorId: contexto.valor.id,
    autorRol: contexto.valor.rol,
  });

  // Query al perfil del autor para obtener nombre, apellido y enviar_correo_al_asignar.
  const { data: perfilAutor } = await cliente
    .from('profiles')
    .select('nombre, apellido, enviar_correo_al_asignar')
    .eq('id', contexto.valor.id)
    .single();

  // after() de Next.js encola el trabajo post-respuesta (Req 13.14).
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
      operacion: 'creacion',
    });
  });

  // ── 6. Respuesta 201 con advertencias (Req 13.15: correo_intentado sin esperar) ─
  return Response.json(
    { data: resultado.valor.evento, advertencias: resultado.valor.advertencias, correo_intentado: true },
    { status: 201 },
  );
}
