import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { questionSchema } from '@/lib/validations/question-bank.schema';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 });
  }

  const { data: question, error } = await supabase
    .from('qb_questions')
    .select('*')
    .eq('id', id)
    .eq('tenant', tenantConfig.id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  // Get tags for this question
  const { data: tags } = await supabase
    .from('qb_question_tags')
    .select('tag_id, qb_tags(id, name)')
    .eq('question_id', id);

  return NextResponse.json({
    ...question,
    tags: tags?.map(t => (t as unknown as { qb_tags: { id: string; name: string } }).qb_tags) || [],
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = questionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDACION', issues: parsed.error.issues }, { status: 400 });
  }

  const { tag_ids, ...questionData } = parsed.data;

  // Update question
  const { data: question, error } = await supabase
    .from('qb_questions')
    .update({
      ...questionData,
      options: questionData.options as unknown as import('@/lib/supabase/types').Json,
      updated_by: user.id,
    })
    .eq('id', id)
    .eq('tenant', tenantConfig.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  // Sync tags: delete all, then re-insert
  await supabase
    .from('qb_question_tags')
    .delete()
    .eq('question_id', id);

  if (tag_ids && tag_ids.length > 0) {
    const tagRows = tag_ids.map(tag_id => ({
      question_id: id,
      tag_id,
    }));

    await supabase.from('qb_question_tags').insert(tagRows);
  }

  return NextResponse.json(question);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 });
  }

  const { error } = await supabase
    .from('qb_questions')
    .delete()
    .eq('id', id)
    .eq('tenant', tenantConfig.id);

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
