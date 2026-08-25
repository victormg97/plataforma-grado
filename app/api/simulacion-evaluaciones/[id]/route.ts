import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { simulacionEvaluacionSchema } from '@/lib/validations/simulacion-evaluacion.schema';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = simulacionEvaluacionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  // Verify the user is the profesor for this evaluacion
  const { data: evaluacion } = await supabase
    .from('simulacion_evaluaciones')
    .select('id, profesor_id')
    .eq('id', id)
    .single();

  if (!evaluacion) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  if (evaluacion.profesor_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Update the evaluacion
  const { data, error } = await supabase
    .from('simulacion_evaluaciones')
    .update({
      nota: parsed.data.nota,
      feedback: parsed.data.feedback ?? null,
      estado: parsed.data.nota != null ? 'calificada' : 'pendiente',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
