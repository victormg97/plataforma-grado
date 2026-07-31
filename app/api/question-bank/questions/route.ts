import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { questionSchema } from '@/lib/validations/question-bank.schema';

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const search = searchParams.get('search') || null;
  const categoryId = searchParams.get('categoryId') || null;
  const tagIdsRaw = searchParams.get('tagIds');
  const tagIds = tagIdsRaw ? tagIdsRaw.split(',') : null;
  const type = searchParams.get('type') || null;
  const difficulty = searchParams.get('difficulty') || null;
  const status = searchParams.get('status') || null;
  const dateFrom = searchParams.get('dateFrom') || null;
  const dateTo = searchParams.get('dateTo') || null;
  const subjectId = searchParams.get('subjectId') || null;

  const { data, error } = await supabase.rpc('get_qb_questions', {
    p_tenant: tenantConfig.id,
    p_search: search,
    p_category_id: categoryId,
    p_tag_ids: tagIds,
    p_type: type,
    p_difficulty: difficulty,
    p_status: status,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_subject_id: subjectId,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
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

  // Insert question
  const { data: question, error } = await supabase
    .from('qb_questions')
    .insert({
      ...questionData,
      options: questionData.options as unknown as import('@/lib/supabase/types').Json,
      tenant: tenantConfig.id,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  // Insert tags if provided
  if (tag_ids && tag_ids.length > 0) {
    const tagRows = tag_ids.map(tag_id => ({
      question_id: question.id,
      tag_id,
    }));

    const { error: tagError } = await supabase
      .from('qb_question_tags')
      .insert(tagRows);

    if (tagError) {
      console.error('Error inserting question tags:', tagError);
    }
  }

  return NextResponse.json(question, { status: 201 });
}
