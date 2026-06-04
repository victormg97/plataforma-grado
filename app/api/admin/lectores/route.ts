import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type LectorAdmin = {
  id: string;
  nombre: string;
  apellido: string;
  apellido_materno: string | null;
  email: string;
  telefono: string | null;
  avatar_url: string | null;
  activo: boolean;
  created_at: string;
};

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, apellido_materno, email, telefono, avatar_url, activo, created_at')
    .eq('rol', 'lector')
    .order('nombre', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
