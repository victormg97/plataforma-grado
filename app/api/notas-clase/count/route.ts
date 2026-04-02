import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/notas-clase/count?ids=id1,id2,...
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const idsParam = request.nextUrl.searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'ids requerido' }, { status: 400 });
  }

  const ids = idsParam.split(',').filter(Boolean).slice(0, 100); // limit to 100
  if (ids.length === 0) {
    return NextResponse.json({});
  }

  const { data, error } = await supabase
    .from('notas_clase')
    .select('horario_id')
    .in('horario_id', ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Count per horario_id
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.horario_id] = (counts[row.horario_id] ?? 0) + 1;
  }

  return NextResponse.json(counts);
}
