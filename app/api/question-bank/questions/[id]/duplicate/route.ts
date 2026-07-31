import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // Fetch original question
  const { data: original, error: fetchError } = await supabase
    .from('qb_questions')
    .select('*')
    .eq('id', id)
    .eq('tenant', tenantConfig.id)
    .single();

  if (fetchError || !original) {
    return NextResponse.json({ error: 'NO_ENCONTRADO' }, { status: 404 });
  }

  // Create duplicate (as draft)
  const { data: duplicate, error: insertError } = await supabase
    .from('qb_questions')
    .insert({
      tenant: tenantConfig.id,
      type: original.type,
      content: original.content,
      options: original.options,
      explanation: original.explanation,
      category_id: original.category_id,
      difficulty: original.difficulty,
      status: 'draft', // Always start as draft
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'ERROR_DB', message: insertError.message }, { status: 500 });
  }

  // Copy tags
  const { data: tags } = await supabase
    .from('qb_question_tags')
    .select('tag_id')
    .eq('question_id', id);

  if (tags && tags.length > 0) {
    await supabase
      .from('qb_question_tags')
      .insert(tags.map(t => ({ question_id: duplicate.id, tag_id: t.tag_id })));
  }

  return NextResponse.json(duplicate, { status: 201 });
}
