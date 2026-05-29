import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidCancellationDeadline } from '@/lib/validations/asistencia';
import { isEmailEnabled } from '@/lib/email/resendClient';

export async function GET() {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // For alumnos: also fetch extended data
    if (profile.rol === 'alumno') {
      const { data: extra } = await supabase
        .from('alumnos_extra')
        .select('*')
        .eq('alumno_id', user.id)
        .maybeSingle() as unknown as { data: Record<string, unknown> | null };

      return NextResponse.json({ ...profile, alumno_extra: extra ?? null, email_disponible: isEmailEnabled() });
    }

    return NextResponse.json({ ...profile, alumno_extra: null, email_disponible: isEmailEnabled() });
  } catch {
    return NextResponse.json({ error: 'Error al obtener perfil' }, { status: 500 });
  }
}

/**
 * Splits "Apellidos" input into apellido (paterno) and apellido_materno.
 * First word → paterno, everything after first space → materno (handles compound surnames).
 * Single word → apellido_materno = null.
 */
function splitApellidos(apellidos: string): { apellido: string; apellido_materno: string | null } {
  const trimmed = apellidos.trim().replace(/\s+/g, ' ');
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { apellido: trimmed, apellido_materno: null };
  return {
    apellido: trimmed.slice(0, spaceIdx),
    apellido_materno: trimmed.slice(spaceIdx + 1).trim() || null,
  };
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim();
      if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
      profileUpdate.nombre = nombre;
    }

    if (body.apellidos !== undefined) {
      const raw = String(body.apellidos).trim();
      if (!raw) return NextResponse.json({ error: 'El apellido es requerido' }, { status: 400 });
      const { apellido, apellido_materno } = splitApellidos(raw);
      profileUpdate.apellido = apellido;
      profileUpdate.apellido_materno = apellido_materno;
    }

    if (body.telefono !== undefined) {
      profileUpdate.telefono = body.telefono ? String(body.telefono).trim() || null : null;
    }

    if (body.avatar_url !== undefined) {
      profileUpdate.avatar_url = body.avatar_url || null;
    }

    // Preference fields
    if (body.idioma !== undefined) {
      const VALID_LOCALES = ['es', 'en'];
      const idioma = String(body.idioma).trim();
      if (VALID_LOCALES.includes(idioma)) profileUpdate.idioma = idioma;
    }

    if (body.tema !== undefined) {
      const tema = String(body.tema).trim();
      if (tema === 'light' || tema === 'dark') profileUpdate.tema = tema;
    }

    if (body.duracion_clase_default_min !== undefined || body.cancellation_deadline_hours !== undefined) {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();
      const rolActual = currentProfile?.rol;

      if (body.duracion_clase_default_min !== undefined) {
        if (rolActual === 'profesor' || rolActual === 'admin') {
          const val = Number(body.duracion_clase_default_min);
          if (!Number.isInteger(val) || val < 15 || val > 480) {
            return NextResponse.json({ error: 'duracion_clase_default_min debe ser un entero entre 15 y 480' }, { status: 400 });
          }
          profileUpdate.duracion_clase_default_min = val;
        }
      }

      if (body.cancellation_deadline_hours !== undefined) {
        if (rolActual === 'profesor' || rolActual === 'admin') {
          const val = Number(body.cancellation_deadline_hours);
          if (!isValidCancellationDeadline(val)) {
            return NextResponse.json({ error: 'cancellation_deadline_hours debe ser un entero entre 0 y 168' }, { status: 400 });
          }
          profileUpdate.cancellation_deadline_hours = val;
        }
      }
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.id)
      .select()
      .single();

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    // For alumnos: upsert editable extra fields
    // RLS policy "Alumno edita sus propios campos de perfil" allows UPDATE on own row.
    if (updatedProfile.rol === 'alumno') {
      const hasExtraFields =
        body.universidad !== undefined ||
        body.año_ingreso !== undefined ||
        'ha_dado_examen' in body ||
        'intentos_prueba' in body;
      if (hasExtraFields) {
        const extraUpdate: Record<string, unknown> = {
          alumno_id: user.id,
          updated_at: new Date().toISOString(),
        };
        if (body.universidad !== undefined) extraUpdate.universidad = body.universidad || null;
        if (body.año_ingreso !== undefined) extraUpdate.año_ingreso = body.año_ingreso || null;
        if ('ha_dado_examen' in body) extraUpdate.ha_dado_examen = Boolean(body.ha_dado_examen);
        if ('intentos_prueba' in body) extraUpdate.intentos_prueba = body.intentos_prueba ?? null;

        const { error: upsertError } = await supabase
          .from('alumnos_extra')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .upsert(extraUpdate as any, { onConflict: 'alumno_id' });

        if (upsertError) {
          return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json(updatedProfile);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 });
  }
}
