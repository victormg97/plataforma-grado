import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import type { QbQuestionType, QbDifficulty } from '@/lib/supabase/types';

interface ImportRow {
  type: string;
  content: string;
  options: string; // JSON string or semicolon-separated
  correct: string; // indices or true/false
  explanation?: string;
  subject?: string;
  category?: string;
  tags?: string;
  difficulty?: string;
}

const VALID_TYPES: QbQuestionType[] = ['single_choice', 'multiple_choice', 'true_false', 'open_ended', 'fill_blank', 'matching'];
const VALID_DIFFICULTIES: QbDifficulty[] = ['easy', 'medium', 'hard'];

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
  const { rows, fileName } = body as { rows: ImportRow[]; fileName: string };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'VALIDACION', message: 'No hay filas para importar' }, { status: 400 });
  }

  // Create import batch
  const { data: batch, error: batchError } = await supabase
    .from('qb_import_batches')
    .insert({
      tenant: tenantConfig.id,
      imported_by: user.id,
      file_name: fileName || 'import.csv',
      total_rows: rows.length,
    })
    .select()
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: 'ERROR_DB', message: batchError?.message }, { status: 500 });
  }

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ row: number; message: string }> = [];

  // Get existing categories, subjects & tags for matching
  const { data: existingCategories } = await supabase
    .from('qb_categories')
    .select('id, name')
    .eq('tenant', tenantConfig.id);

  const { data: existingTags } = await supabase
    .from('qb_tags')
    .select('id, name')
    .eq('tenant', tenantConfig.id);

  const { data: existingSubjects } = await supabase
    .from('qb_subjects')
    .select('id, name')
    .eq('tenant', tenantConfig.id);

  const categoryMap = new Map((existingCategories || []).map(c => [c.name.toLowerCase(), c.id]));
  const tagMap = new Map((existingTags || []).map(t => [t.name.toLowerCase(), t.id]));
  const subjectMap = new Map((existingSubjects || []).map(s => [s.name.toLowerCase(), s.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      // Validate type
      const type = row.type?.trim().toLowerCase() as QbQuestionType;
      if (!VALID_TYPES.includes(type)) {
        errors.push({ row: rowNum, message: `Tipo inválido: "${row.type}". Valores válidos: ${VALID_TYPES.join(', ')}` });
        errorCount++;
        continue;
      }

      // Validate content
      if (!row.content?.trim()) {
        errors.push({ row: rowNum, message: 'El texto de la pregunta es requerido' });
        errorCount++;
        continue;
      }

      // Parse options based on type
      let options: unknown;
      try {
        options = parseOptions(type, row.options, row.correct);
      } catch (e) {
        errors.push({ row: rowNum, message: `Error en opciones: ${(e as Error).message}` });
        errorCount++;
        continue;
      }

      // Parse difficulty
      const diffRaw = row.difficulty?.trim().toLowerCase();
      const difficulty: string | null = VALID_DIFFICULTIES.includes(diffRaw as QbDifficulty)
        ? diffRaw as QbDifficulty
        : null;

      // Resolve category (create if needed)
      let categoryId: string | null = null;
      if (row.category?.trim()) {
        const catName = row.category.trim();
        const existing = categoryMap.get(catName.toLowerCase());
        if (existing) {
          categoryId = existing;
        } else {
          const { data: newCat } = await supabase
            .from('qb_categories')
            .insert({ name: catName, tenant: tenantConfig.id })
            .select('id')
            .single();
          if (newCat) {
            categoryId = newCat.id;
            categoryMap.set(catName.toLowerCase(), newCat.id);
          }
        }
      }

      // Resolve subject (create if needed)
      let subjectId: string | null = null;
      if (row.subject?.trim()) {
        const subName = row.subject.trim();
        const existing = subjectMap.get(subName.toLowerCase());
        if (existing) {
          subjectId = existing;
        } else {
          const { data: newSub } = await supabase
            .from('qb_subjects')
            .insert({ name: subName, tenant: tenantConfig.id })
            .select('id')
            .single();
          if (newSub) {
            subjectId = newSub.id;
            subjectMap.set(subName.toLowerCase(), newSub.id);
          }
        }
      }

      // Insert question
      const { data: question, error: qError } = await supabase
        .from('qb_questions')
        .insert({
          tenant: tenantConfig.id,
          type,
          content: row.content.trim(),
          options: options as import('@/lib/supabase/types').Json,
          explanation: row.explanation?.trim() || null,
          category_id: categoryId,
          subject_id: subjectId,
          difficulty,
          status: 'active' as const,
          import_batch_id: batch.id,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (qError || !question) {
        errors.push({ row: rowNum, message: qError?.message || 'Error desconocido' });
        errorCount++;
        continue;
      }

      // Resolve tags (create if needed)
      if (row.tags?.trim()) {
        const tagNames = row.tags.split(',').map(t => t.trim()).filter(Boolean);
        const tagIds: string[] = [];

        for (const tagName of tagNames) {
          const existing = tagMap.get(tagName.toLowerCase());
          if (existing) {
            tagIds.push(existing);
          } else {
            const { data: newTag } = await supabase
              .from('qb_tags')
              .insert({ name: tagName, tenant: tenantConfig.id })
              .select('id')
              .single();
            if (newTag) {
              tagIds.push(newTag.id);
              tagMap.set(tagName.toLowerCase(), newTag.id);
            }
          }
        }

        if (tagIds.length > 0) {
          await supabase
            .from('qb_question_tags')
            .insert(tagIds.map(tag_id => ({ question_id: question.id, tag_id })));
        }
      }

      successCount++;
    } catch (e) {
      errors.push({ row: rowNum, message: (e as Error).message || 'Error inesperado' });
      errorCount++;
    }
  }

  // Update batch counts
  await supabase
    .from('qb_import_batches')
    .update({ success_count: successCount, error_count: errorCount })
    .eq('id', batch.id);

  return NextResponse.json({
    batch_id: batch.id,
    total_rows: rows.length,
    success_count: successCount,
    error_count: errorCount,
    errors,
  });
}

function parseOptions(type: QbQuestionType, optionsRaw: string, correctRaw: string): unknown {
  switch (type) {
    case 'single_choice':
    case 'multiple_choice': {
      const opts = optionsRaw?.split(';').map(o => o.trim()).filter(Boolean);
      if (!opts || opts.length < 2) throw new Error('Mínimo 2 opciones separadas por ";"');

      const correctIndices = correctRaw?.split(',').map(c => parseInt(c.trim()) - 1) || [];
      if (correctIndices.length === 0) throw new Error('Debes indicar al menos una opción correcta');

      if (type === 'single_choice' && correctIndices.length !== 1) {
        throw new Error('Para selección única, solo una opción puede ser correcta');
      }

      return opts.map((text, idx) => ({
        text,
        is_correct: correctIndices.includes(idx),
      }));
    }
    case 'true_false': {
      const answer = correctRaw?.trim().toLowerCase();
      if (answer !== 'true' && answer !== 'false' && answer !== 'verdadero' && answer !== 'falso') {
        throw new Error('La respuesta debe ser "verdadero" o "falso"');
      }
      return { correct_answer: answer === 'true' || answer === 'verdadero' };
    }
    case 'open_ended': {
      return { model_answer: optionsRaw?.trim() || undefined };
    }
    case 'fill_blank': {
      const answers = optionsRaw?.split(';').map(a => a.trim()).filter(Boolean);
      if (!answers || answers.length === 0) throw new Error('Debe haber al menos una respuesta válida');
      return {
        blanks: [{ position: 0, accepted_answers: answers }],
      };
    }
    case 'matching': {
      // Options come as alternating "concept1;definition1;concept2;definition2..."
      const parts = optionsRaw?.split(';').map(p => p.trim()).filter(Boolean);
      if (!parts || parts.length < 4 || parts.length % 2 !== 0) {
        throw new Error('Para emparejamiento se necesitan pares: concepto1;definición1;concepto2;definición2...');
      }
      const pairs = [];
      for (let i = 0; i < parts.length; i += 2) {
        pairs.push({ left: parts[i], right: parts[i + 1] });
      }
      return { pairs };
    }
    default:
      throw new Error(`Tipo no soportado: ${type}`);
  }
}
