import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validarCodigo } from '@/lib/enlaces/acciones';

// GET público: valida un único código contra la BD usando el service role.
// Devuelve solo si el código es válido y su tipo; no expone otros enlaces ni el
// motivo exacto de invalidez.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'FALTA_CODIGO' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: enlace } = await admin
    .from('enlaces_invitacion')
    .select('tipo, estado, eliminado')
    .eq('codigo', code)
    .maybeSingle();

  if (!validarCodigo(enlace)) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, tipo: enlace!.tipo });
}
