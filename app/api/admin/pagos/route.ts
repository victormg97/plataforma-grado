import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Shared type for the enriched alumno+pago response
export type AlumnoPago = {
  alumno_id: string;
  nombre: string;
  apellido: string;
  avatar_url: string | null;
  activo: boolean;
  profesor: { id: string; nombre: string; apellido: string } | null;
  pago: {
    id: string;
    estado: 'pagado' | 'parcial';
    monto_pagado: number | null;
    fecha_pago: string;
  } | null;
};

async function getAdminUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (profile?.rol !== 'admin') return null;
  return user;
}

// GET /api/admin/pagos?año=2026&mes=4
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const admin = await getAdminUser(supabase);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const año = parseInt(searchParams.get('año') ?? String(new Date().getFullYear()), 10);
  const mes = parseInt(searchParams.get('mes') ?? String(new Date().getMonth() + 1), 10);

  if (isNaN(año) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  // Fetch all alumnos with their extra data (profesor_id)
  const { data: alumnos, error: alumnosError } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, avatar_url, activo')
    .eq('rol', 'alumno')
    .order('nombre');

  if (alumnosError) return NextResponse.json({ error: alumnosError.message }, { status: 500 });

  const alumnoIds = (alumnos ?? []).map((a) => a.id);
  if (alumnoIds.length === 0) return NextResponse.json([]);

  // Fetch extras (profesor assignments)
  const { data: extras } = await supabase
    .from('alumnos_extra')
    .select('alumno_id, profesor_id')
    .in('alumno_id', alumnoIds);

  const extrasMap = new Map(
    (extras ?? []).map((e) => [e.alumno_id as string, e.profesor_id as string | null])
  );

  // Fetch profesores referenced
  const profesorIds = [...new Set((extras ?? []).map((e) => e.profesor_id).filter(Boolean))] as string[];
  const { data: profData } = profesorIds.length > 0
    ? await supabase.from('profiles').select('id, nombre, apellido').in('id', profesorIds)
    : { data: [] };
  const profMap = new Map((profData ?? []).map((p) => [p.id, p]));

  // Fetch pagos for the requested month
  const { data: pagos, error: pagosError } = await supabase
    .from('pagos')
    .select('id, alumno_id, estado, monto_pagado, fecha_pago')
    .in('alumno_id', alumnoIds)
    .eq('anio', año)
    .eq('mes', mes);

  if (pagosError) return NextResponse.json({ error: pagosError.message }, { status: 500 });

  const pagosMap = new Map(
    (pagos ?? []).map((p) => [p.alumno_id as string, p])
  );

  const result: AlumnoPago[] = (alumnos ?? []).map((a) => {
    const profesorId = extrasMap.get(a.id) ?? null;
    const profesor = profesorId ? (profMap.get(profesorId) ?? null) : null;
    const pago = pagosMap.get(a.id);
    return {
      alumno_id: a.id,
      nombre: a.nombre,
      apellido: a.apellido,
      avatar_url: a.avatar_url,
      activo: a.activo,
      profesor: profesor ? { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido } : null,
      pago: pago
        ? {
            id: pago.id as string,
            estado: pago.estado as 'pagado' | 'parcial',
            monto_pagado: pago.monto_pagado as number | null,
            fecha_pago: pago.fecha_pago as string,
          }
        : null,
    };
  });

  return NextResponse.json(result);
}

// POST /api/admin/pagos — upsert or delete payment
// Body: { alumno_id, año, mes, estado: 'pagado'|'parcial'|'pendiente', monto_pagado? }
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await getAdminUser(supabase);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json() as {
    alumno_id: string;
    año: number;
    mes: number;
    estado: 'pagado' | 'parcial' | 'pendiente';
    monto_pagado?: number | null;
  };

  const { alumno_id, año, mes, estado, monto_pagado } = body;

  if (!alumno_id || !año || !mes || !estado) {
    return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 });
  }

  // 'pendiente' means delete the record
  if (estado === 'pendiente') {
    const { error } = await supabase
      .from('pagos')
      .delete()
      .eq('alumno_id', alumno_id)
      .eq('anio', año)
      .eq('mes', mes);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Upsert paid or partial
  const { data, error } = await supabase
    .from('pagos')
    .upsert(
      {
        alumno_id,
        anio: año,
        mes,
        estado,
        monto_pagado: estado === 'parcial' ? (monto_pagado ?? null) : null,
        fecha_pago: new Date().toISOString(),
      },
      { onConflict: 'alumno_id,anio,mes' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
