import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/admin/pagos/columna
// Body: { año: number; mes: number; estado: 'pagado' | 'parcial' | 'pendiente'; monto_pagado?: number }
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const body = await request.json();
  const { año, mes, estado, monto_pagado } = body as {
    año: number;
    mes: number;
    estado: string;
    monto_pagado?: number;
  };

  if (!año || !mes || !estado) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }
  if (!['pagado', 'parcial', 'pendiente'].includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }
  if (mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'Mes inválido' }, { status: 400 });
  }

  const { error } = await supabase.rpc('admin_pagar_mes_columna', {
    p_anio: año,
    p_mes: mes,
    p_estado: estado,
    p_monto: monto_pagado ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
