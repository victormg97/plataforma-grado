import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';
import {
  QUIZ_ICON_BUCKET,
  quizItemSaveSchema,
  quizReorderSchema,
  type AdminQuizSubjectConfig,
} from '@/lib/comunidad/quiz-display';

function rpcError(error: { code?: string; message: string }) {
  const status = error.code === '42501' ? 403 : 500;
  return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status });
}

// GET: every subject with its presentation config and its categories (1 RPC).
export async function GET() {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_get_quiz_config', { p_tenant: tenantConfig.id });
  if (error) return rpcError(error);

  return NextResponse.json((data ?? []) as unknown as AdminQuizSubjectConfig[]);
}

// PUT: partial update of one subject (category_id null) or one category of a
// subject. Returns the full refreshed config. A replaced custom image is
// removed from storage (best effort).
export async function PUT(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = quizItemSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'INVALID' }, { status: 400 });
  }

  const { subject_id, category_id, patch } = parsed.data;

  // Uploaded images must live under this tenant's folder.
  if (patch.icon_image_path && !patch.icon_image_path.startsWith(`${tenantConfig.id}/`)) {
    return NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_save_quiz_item', {
    p_tenant: tenantConfig.id,
    p_subject_id: subject_id,
    p_category_id: category_id ?? null,
    p_patch: patch,
  });
  if (error) return rpcError(error);

  const result = data as unknown as {
    ok: boolean;
    error_code?: string;
    previous_icon_image_path?: string | null;
    config?: AdminQuizSubjectConfig[];
  };
  if (!result.ok) return NextResponse.json({ error: result.error_code ?? 'ERROR' }, { status: 400 });

  const prev = result.previous_icon_image_path;
  if ('icon_image_path' in patch && prev && prev !== patch.icon_image_path) {
    await createAdminClient().storage.from(QUIZ_ICON_BUCKET).remove([prev]).catch(() => undefined);
  }

  return NextResponse.json(result.config ?? []);
}

// PATCH: manual order. subject_id null → reorder subjects; otherwise the
// categories of that subject. Returns the full refreshed config.
export async function PATCH(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = quizReorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_reorder_quiz_items', {
    p_tenant: tenantConfig.id,
    p_subject_id: parsed.data.subject_id ?? null,
    p_ids: parsed.data.ids,
  });
  if (error) return rpcError(error);

  return NextResponse.json(((data as { config?: unknown })?.config ?? []) as AdminQuizSubjectConfig[]);
}
