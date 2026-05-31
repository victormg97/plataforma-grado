import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  }

  // Single RPC call instead of 4 separate queries
  const { data, error } = await supabase.rpc('get_admin_stats');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stats = data as any;
  return NextResponse.json({
    total_alumnos: stats?.total_alumnos ?? 0,
    total_profesores: stats?.total_profesores ?? 0,
    clases_hoy: stats?.clases_hoy ?? 0,
    clases_semana: stats?.clases_semana ?? 0,
    clases_mes: stats?.clases_mes ?? 0,
    pendientes: stats?.pendientes_confirmar ?? 0,
    estado_pendientes: stats?.estado_pendientes ?? 0,
    estado_confirmadas: stats?.estado_confirmadas ?? 0,
    estado_canceladas: stats?.estado_canceladas ?? 0,
  });
}
