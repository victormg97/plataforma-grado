import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateShortCode } from '@/lib/utils/invitations';
import { authorizeCreate } from '@/lib/enlaces/autorizacion';
import type { Actor, EnlaceListItem, PersonaResumen } from '@/lib/enlaces/types';

const TENANT = process.env.NEXT_PUBLIC_TENANT_ID || 'cta-graduados';

// Longitud del código: 24 chars sobre alfabeto de 54 símbolos ≈ 138 bits (>128).
const CODE_LENGTH = 24;

interface ProfileRow {
  id: string;
  nombre: string;
  apellido: string;
  apellido_materno?: string | null;
  email?: string | null;
  activo: boolean;
}

function persona(p: ProfileRow | null | undefined): PersonaResumen | null {
  if (!p) return null;
  return { id: p.id, nombre: p.nombre, apellido: p.apellido, apellido_materno: p.apellido_materno ?? null, email: p.email ?? null };
}

// ─── GET: listar enlaces según rol (RLS) ──────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, puede_crear_alumno')
    .eq('id', user.id)
    .single();

  const esAdmin = profile?.rol === 'admin';
  const esProfesorHabilitado =
    profile?.rol === 'profesor' && profile?.puede_crear_alumno === true;

  if (!esAdmin && !esProfesorHabilitado) {
    return NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 });
  }

  // RLS filtra por rol; el filtro defensivo por tenant es redundante (una BD por
  // tenant) pero se incluye por portabilidad.
  const { data: rows, error } = await supabase
    .from('enlaces_invitacion')
    .select(
      `id, codigo, tipo, estado, created_by, profesor_asignado, usuario_creado, created_at, updated_at,
       creador:created_by ( id, nombre, apellido, activo ),
       profesor:profesor_asignado ( id, nombre, apellido, activo ),
       usuario: usuario_creado ( id, nombre, apellido, apellido_materno, email, activo )`,
    )
    .eq('tenant', TENANT)
    .eq('eliminado', false)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  const result: EnlaceListItem[] = (rows ?? []).map((r) => {
    const creador = r.creador as unknown as ProfileRow | null;
    const profesor = r.profesor as unknown as ProfileRow | null;
    const usuario = r.usuario as unknown as ProfileRow | null;
    return {
      id: r.id,
      codigo: r.codigo,
      tipo: r.tipo,
      estado: r.estado,
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      creador: persona(creador),
      profesor_asignado: r.profesor_asignado,
      profesor: persona(profesor),
      usuario_creado: r.usuario_creado,
      usuario: usuario
        ? { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, apellido_materno: usuario.apellido_materno ?? null, email: usuario.email ?? null, activo: usuario.activo }
        : null,
    };
  });

  return NextResponse.json(result);
}

// ─── POST: crear enlace ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, puede_crear_alumno')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const tipo = body?.tipo;
  const profesorAsignadoInput: string | null = body?.profesor_asignado ?? null;

  const actor: Actor = {
    id: user.id,
    rol: profile.rol,
    puede_crear_alumno: profile.puede_crear_alumno === true,
  };

  const auth = authorizeCreate(actor, { tipo, profesor_asignado: profesorAsignadoInput });

  if (!auth.ok) {
    const status = auth.motivo === 'tipo_invalido' ? 422 : 403;
    const error = auth.motivo === 'tipo_invalido' ? 'VALIDACION' : 'PROHIBIDO';
    return NextResponse.json({ error }, { status });
  }

  // Validar el profesor asignado (solo aplica a enlaces de alumno del admin).
  let profesorAsignado = auth.enlace.profesor_asignado;
  if (auth.enlace.tipo === 'alumno' && actor.rol === 'admin' && profesorAsignadoInput) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, rol')
      .eq('id', profesorAsignadoInput)
      .maybeSingle();

    if (!prof || (prof.rol !== 'profesor' && prof.rol !== 'admin')) {
      return NextResponse.json({ error: 'VALIDACION', message: 'profesor_asignado inválido' }, { status: 422 });
    }
    profesorAsignado = prof.id;
  }

  // Generar código único (reintenta ante colisión improbable del índice único).
  let codigo = generateShortCode(CODE_LENGTH);
  let insertOk = false;
  let inserted: { id: string; codigo: string } | null = null;

  for (let intento = 0; intento < 3 && !insertOk; intento++) {
    const { data, error } = await supabase
      .from('enlaces_invitacion')
      .insert({
        tenant: TENANT,
        codigo,
        tipo: auth.enlace.tipo,
        estado: auth.enlace.estado,
        created_by: auth.enlace.created_by,
        profesor_asignado: profesorAsignado,
      })
      .select('id, codigo')
      .single();

    if (!error && data) {
      inserted = data;
      insertOk = true;
      break;
    }
    // 23505 = unique_violation (colisión de código): reintentar con otro código.
    if (error && error.code === '23505') {
      codigo = generateShortCode(CODE_LENGTH);
      continue;
    }
    if (error) {
      return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
    }
  }

  if (!inserted) {
    return NextResponse.json({ error: 'ERROR_DB' }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id, code: inserted.codigo }, { status: 201 });
}
