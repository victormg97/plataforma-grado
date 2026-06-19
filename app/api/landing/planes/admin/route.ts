import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';

/**
 * GET /api/landing/planes/admin
 * Fetches the raw config for admin editing (requires authenticated admin).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('landing_planes_config')
    .select('*')
    .eq('tenant_slug', tenantConfig.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Config not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * PUT /api/landing/planes/admin
 * Updates the pricing config. Only accessible to admins.
 */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from('landing_planes_config')
    .update({
      oferta_activa: body.oferta_activa,
      oferta_texto: body.oferta_texto || null,
      oferta_mes_automatico: body.oferta_mes_automatico,
      plan1_nombre: body.plan1_nombre,
      plan1_detalle: body.plan1_detalle,
      plan1_precio: body.plan1_precio,
      plan1_precio_antes: body.plan1_precio_antes || null,
      plan2_nombre: body.plan2_nombre,
      plan2_detalle: body.plan2_detalle,
      plan2_precio: body.plan2_precio,
      plan2_precio_antes: body.plan2_precio_antes || null,
      tutoria1_nombre: body.tutoria1_nombre,
      tutoria1_detalle: body.tutoria1_detalle,
      tutoria1_precio: body.tutoria1_precio,
      tutoria2_nombre: body.tutoria2_nombre,
      tutoria2_detalle: body.tutoria2_detalle,
      tutoria2_precio: body.tutoria2_precio,
      lector_precio: body.lector_precio,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_slug', tenantConfig.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
