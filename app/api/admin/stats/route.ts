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

  return NextResponse.json({
    total_alumnos: data?.total_alumnos ?? 0,
    total_profesores: data?.total_profesores ?? 0,
    clases_hoy: data?.clases_hoy ?? 0,
    pendientes: data?.pendientes_confirmar ?? 0,
  });
}
