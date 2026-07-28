import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  emailPlantillaSchema,
  tipoCorreoSchema,
} from '@/lib/validations/emailPlantilla.schema';

/**
 * Rutas del editor de plantillas de correo por tipo.
 *
 * Patrón del proyecto: `createClient()` → `auth.getUser()` → fetch `profiles.rol`
 * → checks de rol → operación → `NextResponse.json` (Requisito 16.7).
 *
 * Solo profesor/admin pueden gestionar plantillas; el rol `alumno` se deniega de
 * plano (Requisito 7.4, 15.8, 16.7).
 */

type Rol = 'alumno' | 'profesor' | 'admin';

/**
 * Resuelve el usuario autenticado y su rol, devolviendo además la respuesta de
 * error a retornar si no procede continuar (401 sin usuario, 403 si es alumno o
 * rol no autorizado).
 */
async function authorizeEditor(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  const rol = (profile?.rol ?? 'alumno') as Rol;

  // Solo profesor/admin gestionan plantillas (Requisito 7.4, 15.8, 16.7).
  if (rol !== 'profesor' && rol !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}

/**
 * PUT /api/email/plantillas/[tipo]
 *
 * Crea o actualiza la Plantilla_Correo del usuario para el `tipo` dado mediante
 * upsert por `(user_id, tipo)` (Requisito 7.2, 7.3, 7.6).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
) {
  const supabase = await createClient();

  const auth = await authorizeEditor(supabase);
  if (!auth.ok) return auth.response;

  // Validar el parámetro `tipo` de la ruta (Requisito 7.6).
  const { tipo: tipoParam } = await params;
  const tipoResult = tipoCorreoSchema.safeParse(tipoParam);
  if (!tipoResult.success) {
    return NextResponse.json(
      { error: 'Tipo de correo no válido' },
      { status: 400 }
    );
  }
  const tipo = tipoResult.data;

  // Parsear y validar el body (asunto 1–200 no vacío, cuerpo no vacío).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición inválido' }, { status: 400 });
  }

  const parsed = emailPlantillaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos de plantilla inválidos', detalles: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { asunto, cuerpo_html, max_caracteres_nota } = parsed.data;

  const { data, error } = await supabase
    .from('email_plantillas')
    .upsert(
      {
        user_id: auth.userId,
        tipo,
        asunto,
        cuerpo_html,
        max_caracteres_nota: max_caracteres_nota ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,tipo' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/email/plantillas/[tipo]
 *
 * Elimina la Plantilla_Correo personalizada del usuario para el `tipo` dado; al
 * eliminarse, el sistema vuelve a aplicar la Plantilla_Default (reset, Req. 7.5).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
) {
  const supabase = await createClient();

  const auth = await authorizeEditor(supabase);
  if (!auth.ok) return auth.response;

  const { tipo: tipoParam } = await params;
  const tipoResult = tipoCorreoSchema.safeParse(tipoParam);
  if (!tipoResult.success) {
    return NextResponse.json(
      { error: 'Tipo de correo no válido' },
      { status: 400 }
    );
  }
  const tipo = tipoResult.data;

  const { error } = await supabase
    .from('email_plantillas')
    .delete()
    .eq('user_id', auth.userId)
    .eq('tipo', tipo);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
