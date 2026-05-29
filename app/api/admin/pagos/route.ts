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

  const { data: rows, error } = await supabase.rpc('get_pagos_mes', { p_año: año, p_mes: mes });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result: AlumnoPago[] = (rows ?? []).map((r: Record<string, unknown>) => ({
    alumno_id: r.alumno_id as string,
    nombre: r.nombre as string,
    apellido: r.apellido as string,
    avatar_url: r.avatar_url as string | null,
    activo: r.activo as boolean,
    paso_prueba: (r.paso_prueba as boolean) ?? false,
    profesor: r.profesor_id
      ? { id: r.profesor_id as string, nombre: r.profesor_nombre as string, apellido: r.profesor_apellido as string }
      : null,
    pago: r.pago_id
      ? {
          id: r.pago_id as string,
          estado: r.pago_estado as 'pagado' | 'parcial',
          monto_pagado: r.pago_monto as number | null,
          fecha_pago: r.pago_fecha as string,
        }
      : null,
  }));

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
        // Persistimos el monto tanto para 'parcial' como para 'pagado'
        // (permite calcular la ganancia mensual). Si no se entrega, queda null.
        monto_pagado: monto_pagado ?? null,
        fecha_pago: new Date().toISOString(),
      },
      { onConflict: 'alumno_id,anio,mes' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
