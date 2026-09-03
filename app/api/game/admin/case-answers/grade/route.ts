import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';

const gradeSchema = z.object({
  case_id: z.string().uuid(),
  user_id: z.string().uuid(),
  quality_score: z.number().int().min(0).max(5).nullable().optional(),
  points: z.number().int().min(0).max(100000).optional(),
  feedback: z.string().max(4000).nullable().optional(),
});

// POST: grade a weekly-case answer (quality score, XP points, feedback).
export async function POST(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = gradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('grade_weekly_case_answer', {
    p_tenant: tenantConfig.id,
    p_case_id: parsed.data.case_id,
    p_user_id: parsed.data.user_id,
    p_quality_score: parsed.data.quality_score ?? null,
    p_points: parsed.data.points ?? 0,
    p_feedback: parsed.data.feedback ?? null,
  });

  if (error) {
    const s = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: 'ERROR', message: error.message }, { status: s });
  }

  const result = data as { ok: boolean; error_code?: string };
  if (!result.ok) {
    return NextResponse.json({ error: result.error_code ?? 'ERROR' }, { status: 400 });
  }

  return NextResponse.json(result);
}
