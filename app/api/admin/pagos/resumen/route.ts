import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type PagoResumenMes = {
  mes: number;
  estado: 'pagado' | 'parcial' | null; // null = no record (pending)
  monto_pagado: number | null;
};

export type AlumnoResumenAnual = {
  alumno_id: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  paso_prueba: boolean;
  pagos: PagoResumenMes[];
};

// GET /api/admin/pagos/resumen?año=2026
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const año = parseInt(searchParams.get('año') ?? String(new Date().getFullYear()), 10);
  if (isNaN(año)) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  // Fetch all alumnos
  const { data: alumnos, error: alumnosError } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, activo')
    .eq('rol', 'alumno')
    .order('nombre');

  if (alumnosError) return NextResponse.json({ error: alumnosError.message }, { status: 500 });

  const alumnoIds = (alumnos ?? []).map((a) => a.id);
  if (alumnoIds.length === 0) return NextResponse.json([]);

  // Fetch pagos and alumnos_extra in parallel
  const [{ data: pagos, error: pagosError }, { data: extras }] = await Promise.all([
    supabase
      .from('pagos')
      .select('alumno_id, mes, estado, monto_pagado')
      .in('alumno_id', alumnoIds)
      .eq('anio', año),
    supabase
      .from('alumnos_extra')
      .select('alumno_id, paso_prueba')
      .in('alumno_id', alumnoIds),
  ]);

  if (pagosError) return NextResponse.json({ error: pagosError.message }, { status: 500 });

  // Build paso_prueba map
  const pasoPruebaMap = new Map<string, boolean>();
  for (const e of extras ?? []) {
    pasoPruebaMap.set(e.alumno_id as string, (e.paso_prueba as boolean) ?? false);
  }

  // Build a map: alumnoId → { mes → pago }
  const pagosMap = new Map<string, Map<number, { estado: string; monto_pagado: number | null }>>();
  for (const p of pagos ?? []) {
    const alumnoId = p.alumno_id as string;
    if (!pagosMap.has(alumnoId)) pagosMap.set(alumnoId, new Map());
    pagosMap.get(alumnoId)!.set(p.mes as number, {
      estado: p.estado as string,
      monto_pagado: p.monto_pagado as number | null,
    });
  }

  const result: AlumnoResumenAnual[] = (alumnos ?? []).map((a) => {
    const alumnosPagos = pagosMap.get(a.id);
    const pagosArr: PagoResumenMes[] = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const p = alumnosPagos?.get(mes);
      return {
        mes,
        estado: p ? (p.estado as 'pagado' | 'parcial') : null,
        monto_pagado: p?.monto_pagado ?? null,
      };
    });
    return {
      alumno_id: a.id,
      nombre: a.nombre,
      apellido: a.apellido,
      activo: a.activo,
      paso_prueba: pasoPruebaMap.get(a.id) ?? false,
      pagos: pagosArr,
    };
  });

  return NextResponse.json(result);
}
