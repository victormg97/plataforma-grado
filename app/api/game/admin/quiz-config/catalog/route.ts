import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import { quizCatalogSchema, type AdminQuizSubjectConfig } from '@/lib/comunidad/quiz-display';

// POST { action, ...args }: create / rename / delete subjects and create /
// link / rename / remove categories from the "Cuestionarios" tab. One RPC
// (admin_manage_quiz_catalog) that never deletes anything with questions and
// returns the refreshed config.
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = quizCatalogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'INVALID' }, { status: 400 });
  }

  const { action, ...args } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_manage_quiz_catalog', {
    p_tenant: tenantConfig.id,
    p_action: action,
    p_args: args,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status });
  }

  const result = data as unknown as {
    ok: boolean;
    error_code?: string;
    count?: number;
    id?: string;
    config?: AdminQuizSubjectConfig[];
  };

  if (!result.ok) {
    const status = result.error_code === 'DUPLICATE' || result.error_code === 'HAS_QUESTIONS' ? 409 : 400;
    return NextResponse.json({ error: result.error_code ?? 'ERROR', count: result.count }, { status });
  }

  return NextResponse.json({ id: result.id ?? null, config: result.config ?? [] });
}
