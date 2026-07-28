import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDefaultTemplate } from '@/lib/email/templates';
import { TIPOS_CORREO } from '@/lib/validations/emailPlantilla.schema';

/**
 * GET /api/email/plantillas
 *
 * Devuelve, para cada uno de los tipos de correo soportados, el contenido EFECTIVO
 * (asunto y cuerpo HTML) que se usaría al construir el correo: la Plantilla_Correo
 * personalizada del usuario si existe, o la Plantilla_Default en caso contrario.
 *
 * Sigue el patrón del proyecto: `createClient()` → `auth.getUser()` → fetch
 * `profiles.rol` → checks → `NextResponse.json` (Requisito 16.7).
 *
 * - Requiere usuario autenticado (401 si no lo hay).
 * - Solo profesor/admin pueden acceder; el rol `alumno` (o cualquier otro rol) se
 *   deniega con 403 (Requisito 6.5, 16.7).
 * - El idioma del preview por defecto es el del propio profesor/admin
 *   (`profiles.idioma`), con español como respaldo (Requisito 7.1).
 */
export async function GET() {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('rol, idioma')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    // Solo profesor/admin pueden gestionar plantillas (Requisito 6.5, 16.7).
    if (profile.rol !== 'profesor' && profile.rol !== 'admin') {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    // Plantillas personalizadas del usuario (vía RLS con el client server normal).
    const { data: personalizadas, error: plantillasError } = await supabase
      .from('email_plantillas')
      .select('tipo, asunto, cuerpo_html, max_caracteres_nota')
      .eq('user_id', user.id);

    if (plantillasError) {
      return NextResponse.json({ error: plantillasError.message }, { status: 500 });
    }

    const porTipo = new Map(
      (personalizadas ?? []).map((p) => [p.tipo, p]),
    );

    // Para cada tipo soportado, devolver el contenido efectivo (personalizado o default).
    const plantillas = TIPOS_CORREO.map((tipo) => {
      const personalizada = porTipo.get(tipo);
      if (personalizada) {
        return {
          tipo,
          personalizada: true,
          asunto: personalizada.asunto,
          cuerpo_html: personalizada.cuerpo_html,
          max_caracteres_nota: personalizada.max_caracteres_nota ?? null,
        };
      }
      const def = getDefaultTemplate(tipo, profile.idioma ?? 'es');
      return {
        tipo,
        personalizada: false,
        asunto: def.asunto,
        cuerpo_html: def.cuerpoHtml,
        max_caracteres_nota: null,
      };
    });

    return NextResponse.json({ plantillas });
  } catch {
    return NextResponse.json({ error: 'Error al obtener las plantillas' }, { status: 500 });
  }
}
