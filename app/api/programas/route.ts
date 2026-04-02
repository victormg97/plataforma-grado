import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EstadoPrograma } from '@/lib/supabase/types';
import { programaSchema } from '@/lib/validations/programa.schema';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado') ?? 'activo';

  // Alumnos don't have access to this endpoint
  if (profile.rol === 'alumno') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  let query = supabase
    .from('programas_clases')
    .select(`
      *,
      profesor:profiles!programas_clases_profesor_id_fkey(id, nombre, apellido, avatar_url),
      creado_por:profiles!programas_clases_created_by_fkey(id, nombre, apellido),
      programa_profesores(profesor_id, profesor:profiles!programa_profesores_profesor_id_fkey(id, nombre, apellido, avatar_url)),
      clases_programa(id),
      asignaciones_programa(id, estado)
    `)
    .order('created_at', { ascending: false });

  if (estado !== 'todos') {
    query = query.eq('estado', estado as unknown as EstadoPrograma);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add computed counts and flatten profesores_asignados
  const programas = (data ?? []).map((p) => {
    const clases = (p.clases_programa ?? []) as { id: string }[];
    const totalClases = clases.length;
    const totalAsignados = ((p.asignaciones_programa ?? []) as { id: string; estado: string }[])
      .filter((a) => a.estado === 'activo').length;
    const profesoresAsignados = ((p.programa_profesores ?? []) as { profesor: { id: string; nombre: string; apellido: string; avatar_url: string | null } }[])
      .map((pp) => pp.profesor);
    return {
      ...p,
      clases_programa: undefined,
      asignaciones_programa: undefined,
      programa_profesores: undefined,
      profesores_asignados: profesoresAsignados,
      total_clases: totalClases,
      total_pruebas: 0,
      total_asignados: totalAsignados,
    };
  });

  return NextResponse.json(programas);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
  if (profile.rol === 'alumno') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const parsed = programaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { nombre, descripcion, visibilidad, profesor_ids } = parsed.data;

  let finalVisibilidad: 'todos' | 'especifico' = 'todos';
  let finalProfesorIds: string[] = [];

  if (profile.rol === 'admin') {
    finalVisibilidad = visibilidad ?? 'todos';
    finalProfesorIds = (finalVisibilidad === 'especifico' && profesor_ids?.length) ? profesor_ids : [];
  } else {
    // Profesor always creates a specific program for themselves
    finalVisibilidad = 'especifico';
    finalProfesorIds = [user.id];
  }

  const { data, error } = await supabase
    .from('programas_clases')
    .insert({
      nombre,
      descripcion: descripcion ?? null,
      // Keep profesor_id for legacy (set to first assigned prof or null)
      profesor_id: finalProfesorIds[0] ?? null,
      visibilidad: finalVisibilidad,
      created_by: user.id,
      estado: 'activo' as const,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert into junction table
  if (finalProfesorIds.length > 0) {
    await supabase
      .from('programa_profesores')
      .insert(finalProfesorIds.map((pid) => ({ programa_id: data.id, profesor_id: pid })));
  }

  return NextResponse.json(data, { status: 201 });
}
