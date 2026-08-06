'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, ChevronDown, ChevronUp, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ImportPreviewView } from '@/components/question-bank/ImportPreviewView';
import { parseQuestionsFromText, type ParsedQuestion } from '@/lib/question-bank/text-parser';
import type { QbCategory, QbTag, QbSubject } from '@/lib/supabase/types';

interface ImportViewProps {
  categories: QbCategory[];
  tags: QbTag[];
  subjects: QbSubject[];
}

interface ImportRow {
  type: string;
  content: string;
  options: string;
  correct: string;
  explanation: string;
  subject: string;
  category: string;
  tags: string;
  difficulty: string;
}

/**
 * Convert HTML to plain text preserving line breaks and list structure.
 * Uses recursive tree walk to properly handle nested lists from Google Docs/Word.
 * Adds letter prefixes (a. b. c.) for lower-alpha lists and
 * roman prefixes (I. II.) for upper-roman lists.
 */
function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  const result: string[] = [];
  
  function walk(node: Node, listCounter?: { type: string; count: number }) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) result.push(text);
      return;
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    
    // Table row: join cells with tab
    if (tag === 'tr') {
      const cells = el.querySelectorAll('td, th');
      const cellTexts = Array.from(cells).map(c => (c.textContent || '').trim());
      result.push(cellTexts.join('\t'));
      return;
    }
    
    // List items: determine prefix based on parent list style
    if (tag === 'li') {
      const style = el.getAttribute('style') || '';
      const parentStyle = el.parentElement?.getAttribute('style') || '';
      const listType = extractListType(style) || extractListType(parentStyle);
      
      let prefix = '';
      if (listCounter) {
        listCounter.count++;
        if (listCounter.type === 'lower-alpha' || listType === 'lower-alpha') {
          prefix = String.fromCharCode(96 + listCounter.count) + '. ';
        } else if (listCounter.type === 'upper-roman' || listType === 'upper-roman') {
          prefix = toRoman(listCounter.count) + '. ';
        } else if (listCounter.type === 'decimal' || listType === 'decimal') {
          prefix = listCounter.count + '. ';
        }
      }
      
      // Check for nested lists inside this li
      const nestedOl = el.querySelector(':scope > ol, :scope > ul');
      const directText = getDirectText(el);
      
      if (directText.trim()) {
        result.push(prefix + directText.trim());
      }
      
      // Process nested lists with their own counter
      if (nestedOl) {
        const nestedType = extractListType((nestedOl as HTMLElement).getAttribute('style') || '') ||
          extractListType(nestedOl.querySelector('li')?.getAttribute('style') || '');
        const nestedCounter = { type: nestedType || 'decimal', count: 0 };
        for (const child of Array.from(nestedOl.children)) {
          walk(child, nestedCounter);
        }
      }
      return;
    }
    
    // Ordered/unordered list: walk children with counter
    if (tag === 'ol' || tag === 'ul') {
      const listType = extractListType(el.getAttribute('style') || '') ||
        extractListType(el.querySelector('li')?.getAttribute('style') || '');
      const counter = { type: listType || 'decimal', count: 0 };
      for (const child of Array.from(el.children)) {
        walk(child, counter);
      }
      return;
    }
    
    // Block elements: add newline after
    const isBlock = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(tag);
    if (tag === 'br') { result.push(''); return; }
    
    for (const child of Array.from(el.childNodes)) {
      walk(child, listCounter);
    }
    
    if (isBlock && result.length > 0) {
      // Ensure a line break after block elements
      const last = result[result.length - 1];
      if (last !== '') result.push('');
    }
  }
  
  walk(div);
  
  // Join and clean up multiple empty lines
  return result
    .map(l => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function extractListType(style: string): string {
  const match = style.match(/list-style-type:\s*([^;]+)/i);
  if (!match) return '';
  const type = match[1].trim().toLowerCase();
  if (type === 'upper-roman') return 'upper-roman';
  if (type === 'lower-alpha' || type === 'lower-latin') return 'lower-alpha';
  if (type === 'decimal') return 'decimal';
  return type;
}

function getDirectText(el: HTMLElement): string {
  let text = '';
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || '';
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = (child as HTMLElement).tagName.toLowerCase();
      if (tag !== 'ol' && tag !== 'ul') {
        text += (child as HTMLElement).textContent || '';
      }
    }
  }
  return text;
}

function toRoman(num: number): string {
  const vals = [10, 9, 5, 4, 1];
  const syms = ['X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
  }
  return result;
}

export function ImportView({ categories, tags, subjects }: ImportViewProps) {
  const t = useTranslations('bancoPreguntas');
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'paste' | 'preview'>('paste');
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [pasteContent, setPasteContent] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showAiSection, setShowAiSection] = useState(false);
  const [aiPasteText, setAiPasteText] = useState('');

  // Convert ParsedQuestion[] to ImportRow[] for the API
  const convertToRows = useCallback((questions: ParsedQuestion[]): ImportRow[] => {
    return questions.map((q) => {
      let options = '';
      let correct = '';

      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        options = q.options.join(';');
        correct = q.correctIndices.map(i => i + 1).join(',');
      } else if (q.type === 'true_false') {
        correct = q.trueFalseAnswer === true ? 'verdadero' : q.trueFalseAnswer === false ? 'falso' : '';
      } else if (q.type === 'matching') {
        options = q.matchingPairs.map(p => `${p.left};${p.right}`).join(';');
      }

      return {
        type: q.type,
        content: q.content,
        options,
        correct,
        explanation: q.explanation,
        subject: '',
        category: '',
        tags: '',
        difficulty: '',
      };
    });
  }, []);

  const handleProcessText = useCallback(() => {
    if (!pasteContent.trim()) return;
    setProcessing(true);

    // Use setTimeout to avoid blocking UI with large text
    setTimeout(() => {
      try {
        // Get both plain text and HTML from the contentEditable div
        const editorEl = document.getElementById('import-paste-editor');
        const htmlContent = editorEl?.innerHTML || '';
        
        // Extract plain text from HTML preserving line breaks from block elements
        const plainText = htmlToPlainText(htmlContent) || editorEl?.innerText || pasteContent;

        // DEBUG: log what the parser receives
        console.log('[ImportView] plainText first 2000 chars:', plainText.slice(0, 2000));
        console.log('[ImportView] htmlContent first 2000 chars:', htmlContent.slice(0, 2000));

        const questions = parseQuestionsFromText(plainText, htmlContent);

        console.log('[ImportView] Parsed questions:', JSON.stringify(questions.slice(0, 3), null, 2));

        if (questions.length === 0) {
          toast.error(t('sin_preguntas_detectadas'));
          setProcessing(false);
          return;
        }

        const rows = convertToRows(questions);
        setParsedRows(rows);
        setStep('preview');
        toast.success(t('preguntas_detectadas', { count: questions.length }));
      } catch {
        toast.error(t('error_importar'));
      } finally {
        setProcessing(false);
      }
    }, 50);
  }, [pasteContent, convertToRows, t]);

  const handleAiPaste = useCallback(() => {
    if (!aiPasteText.trim()) return;

    const lines = aiPasteText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      toast.error(t('sin_preguntas_detectadas'));
      return;
    }

    const firstLine = lines[0];
    const isTab = firstLine.includes('\t');
    const separator = isTab ? '\t' : ';';
    const headerKeywords = ['tipo', 'pregunta', 'type', 'question'];
    const startIdx = headerKeywords.some(k => firstLine.toLowerCase().includes(k)) ? 1 : 0;

    const rows: ImportRow[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(separator).map(p => p.trim());
      if (parts.length < 2) continue;
      const optionsRaw = (parts[2] || '').replace(/\|/g, ';');
      rows.push({
        type: parts[0] || '',
        content: parts[1] || '',
        options: optionsRaw,
        correct: parts[3] || '',
        explanation: parts[4] || '',
        subject: parts[5] || '',
        category: parts[6] || '',
        tags: parts[7] || '',
        difficulty: parts[8] || '',
      });
    }

    if (rows.length === 0) {
      toast.error(t('sin_preguntas_detectadas'));
      return;
    }

    setParsedRows(rows);
    setStep('preview');
    toast.success(t('preguntas_detectadas', { count: rows.length }));
  }, [aiPasteText, t]);

  const handleImported = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['qb-questions-all'] });
    queryClient.invalidateQueries({ queryKey: ['qb-categories'] });
    queryClient.invalidateQueries({ queryKey: ['qb-tags'] });
    queryClient.invalidateQueries({ queryKey: ['qb-subjects'] });
    setParsedRows([]);
    setPasteContent('');
    setStep('paste');
  }, [queryClient]);

  const handleBack = useCallback(() => {
    setParsedRows([]);
    setStep('paste');
  }, []);

  const copyAiPrompt = useCallback(() => {
    const prompt = `Eres un asistente que convierte preguntas de derecho al formato CSV que necesito para importarlas a mi plataforma.

INSTRUCCIONES:
1. Lee las preguntas que te paso a continuación
2. Conviértelas al formato CSV que describo abajo
3. Tu respuesta debe ser ÚNICAMENTE el CSV completo, empezando por la fila de encabezados
4. Usa punto y coma (;) como separador de columnas del CSV
5. Las opciones de respuesta se separan con el carácter | (pipe)
6. NO uses comillas alrededor de los campos a menos que el texto contenga un ;

ENCABEZADOS DEL CSV:
tipo;pregunta;opciones;correcta;explicacion;materia;categoria;tags;dificultad

VALORES PARA LA COLUMNA "tipo":
- single_choice → Selección única (una sola respuesta correcta)
- multiple_choice → Varias respuestas correctas
- true_false → Verdadero o Falso
- matching → Emparejamiento de conceptos

COLUMNA "opciones":
- Para single_choice y multiple_choice: opciones separadas por | (pipe)
- Para true_false: dejar vacío
- Para matching: pares alternados concepto|definición|concepto|definición

COLUMNA "correcta":
- Para single_choice: número de la opción correcta (1, 2, 3...)
- Para multiple_choice: números separados por coma (1,3,4)
- Para true_false: "verdadero" o "falso"
- Para matching: dejar vacío

COLUMNA "dificultad": easy, medium, hard (o vacío si no estás seguro)

A continuación las preguntas a convertir:
`;
    navigator.clipboard.writeText(prompt).then(() => {
      toast.success(t('prompt_copiado'));
    });
  }, [t]);

  // ─── STEP 1: Paste text ───────────────────────────────────────────────────
  if (step === 'paste') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
            {t('importar_titulo')}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t('importar_desc')}
          </p>
        </div>

        {/* Paste area — contentEditable to preserve HTML (highlighting) */}
        <div>
          <div
            id="import-paste-editor"
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => setPasteContent((e.target as HTMLDivElement).innerText)}
            className="min-h-[300px] max-h-[60vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            data-placeholder={t('importar_pegar_placeholder')}
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          />
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
            <FileText className="inline size-3.5 mr-1" />
            {t('importar_desc')}
          </p>
        </div>

        {/* Process button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleProcessText}
            loading={processing}
            disabled={!pasteContent.trim()}
          >
            {processing ? t('procesando_texto') : t('procesar_texto')}
          </Button>
        </div>

        {/* Collapsible AI section */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAiSection(!showAiSection)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <span>{t('pegar_desde_ia')}</span>
            {showAiSection ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {showAiSection && (
            <div className="border-t border-[var(--color-border)] px-4 py-4 space-y-3">
              <p className="text-xs text-[var(--color-text-muted)]">
                {t('pegar_desde_ia_desc')}
              </p>
              <button
                type="button"
                onClick={copyAiPrompt}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-brand-gold)] hover:underline"
              >
                <ClipboardCopy className="size-4" />
                {t('copiar_prompt')}
              </button>
              <textarea
                value={aiPasteText}
                onChange={(e) => setAiPasteText(e.target.value)}
                placeholder={t('pegar_desde_ia_placeholder')}
                rows={5}
                className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2.5 text-xs font-mono outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!aiPasteText.trim()}
                onClick={handleAiPaste}
              >
                {t('procesar_texto')}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── STEP 2: Preview & Edit ────────────────────────────────────────────────
  return (
    <ImportPreviewView
      rows={parsedRows}
      onChange={setParsedRows}
      onBack={handleBack}
      onImported={handleImported}
      categories={categories}
      tags={tags}
      subjects={subjects}
    />
  );
}
