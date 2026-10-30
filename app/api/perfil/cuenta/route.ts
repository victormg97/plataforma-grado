import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * DELETE /api/perfil/cuenta — Supresión de la cuenta del propio usuario
 * (Ley 21.719, derecho de supresión).
 *
 * Borra de verdad: elimina el usuario de Auth, lo que por cascada (ON DELETE
 * CASCADE desde profiles) arrastra perfil, ficha, asistencia, notificaciones,
 * etc. Antes limpia la única referencia que NO cascada (game_score_reset_log
 * .executed_by es NOT NULL), para que el borrado no quede bloqueado.
 *
 * La identidad se toma SIEMPRE de la sesión server-side: un usuario sólo puede
 * borrarse a sí mismo, nunca a otro.
 */
export async function DELETE() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Limpiar referencias que no cascada (FK NOT NULL en game_score_reset_log).
  //    Sólo tendrá filas si el usuario es/era admin y reseteó puntajes.
  await admin.from('game_score_reset_log').delete().eq('executed_by', user.id);

  // 2. Borrar el usuario de Auth → cascada al resto de sus datos.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json(
      { error: 'No se pudo eliminar la cuenta', message: deleteError.message },
      { status: 500 },
    );
  }

  // 3. Cerrar la sesión y limpiar cookies (la sesión ya no tiene usuario válido).
  await supabase.auth.signOut().catch(() => {});

  const response = NextResponse.json({ ok: true });
  response.cookies.set('x-user-rol', '', { maxAge: 0, path: '/' });
  return response;
}
