'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Upload, Download, AlertCircle, CheckCircle, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ImportPreview } from '@/components/question-bank/ImportPreview';
import * as XLSX from 'xlsx';

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

interface ParsedRow {
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

interface RowError {
  row: number;
  message: string;
}

export function ImportModal({ onClose, onImported }: ImportModalProps) {
  const t = useTranslations('bancoPreguntas');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importResult, setImportResult] = useState<{
    success_count: number;
    error_count: number;
    errors: RowError[];
  } | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseErrors([]);
    setParsedRows([]);
    setImportResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

      if (json.length === 0) {
        setParseErrors(['El archivo está vacío']);
        return;
      }

      // Map columns (support both Spanish and English column names)
      const rows: ParsedRow[] = json.map((row) => ({
        type: (row['tipo'] || row['type'] || '').trim(),
        content: (row['pregunta'] || row['content'] || row['texto'] || '').trim(),
        options: (row['opciones'] || row['options'] || '').trim(),
        correct: (row['correcta'] || row['correct'] || '').trim(),
        explanation: (row['explicacion'] || row['explanation'] || '').trim(),
        subject: (row['materia'] || row['subject'] || '').trim(),
        category: (row['categoria'] || row['category'] || '').trim(),
        tags: (row['tags'] || row['etiquetas'] || '').trim(),
        difficulty: (row['dificultad'] || row['difficulty'] || '').trim(),
      }));

      setParsedRows(rows);
    } catch (e) {
      setParseErrors([(e as Error).message || 'Error al leer el archivo']);
    }
  };

  const handlePasteFromAI = (text: string) => {
    setParseErrors([]);
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      setParseErrors(['El texto está vacío']);
      return;
    }

    // Detect separator: semicolon CSV or tab-separated
    const firstLine = lines[0];
    const isSemicolon = firstLine.includes(';');
    const isTab = firstLine.includes('\t');
    const separator = isTab ? '\t' : ';';

    // Check if first line is headers (skip it)
    const headerKeywords = ['tipo', 'pregunta', 'type', 'question'];
    const startIdx = headerKeywords.some(k => firstLine.toLowerCase().includes(k)) ? 1 : 0;

    const rows: ParsedRow[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(separator).map(p => p.trim());
      if (parts.length < 2) continue; // skip malformed lines

      // Options use | as internal separator in the prompt, convert to ; for our backend
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
      setParseErrors(['No se pudieron detectar preguntas en el texto']);
      return;
    }

    setFileName('pegar-desde-ia.csv');
    setParsedRows(rows);
    setShowPasteArea(false);
    setPasteText('');
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/question-bank/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows, fileName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Error');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      if (data.error_count === 0) {
        toast.success(t('importacion_ok', { count: data.success_count }));
        onImported();
      } else {
        toast.warning(t('importacion_parcial', {
          success: data.success_count,
          total: data.total_rows,
          errors: data.error_count,
        }));
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t('error_importar'));
    },
  });

  const downloadTemplate = () => {
    const headers = ['tipo', 'pregunta', 'opciones', 'correcta', 'explicacion', 'materia', 'categoria', 'tags', 'dificultad'];
    const exampleRows = [
      ['single_choice', '¿Cuál es el plazo para contestar una demanda civil?', 'Opción A;Opción B;Opción C;Opción D', '2', 'El plazo es de 15 días hábiles según el Art. 258 CPC', 'Derecho Civil', 'Derecho Procesal', 'plazos,demanda', 'medium'],
      ['true_false', '¿El recurso de apelación siempre se concede en ambos efectos?', '', 'falso', 'Depende del tipo de resolución', 'Derecho Procesal', 'Recursos procesales', 'recursos', 'hard'],
      ['multiple_choice', '¿Cuáles son elementos del contrato?', 'Consentimiento;Objeto;Causa;Color', '1,2,3', '', 'Derecho Civil', 'Contratos', 'contratos,obligaciones', 'easy'],
      ['open_ended', 'Explique la diferencia entre nulidad absoluta y relativa', 'La nulidad absoluta...', '', '', 'Derecho Civil', 'Acto jurídico', 'nulidad', ''],
      ['fill_blank', 'El plazo para interponer recurso de protección es de ___ días corridos', 'treinta;30', '', '', 'Derecho Constitucional', 'Acciones constitucionales', 'recurso de protección,plazos', ''],
      ['matching', 'Empareja los tipos de contratos con sus características', 'Concepto 1;Definición 1;Concepto 2;Definición 2', '', '', 'Derecho Civil', 'Contratos', 'clasificación', ''],
    ];

    // Prompt sheet for AI assistance
    const promptText = [
      ['INSTRUCCIONES PARA IA — Conversión de preguntas a formato CSV'],
      [''],
      ['Copia este prompt, pégalo en ChatGPT/Claude/Gemini, y a continuación pega tus preguntas.'],
      ['La IA te devolverá un CSV listo para copiar, pegar en "Pegar desde IA" en la app, y confirmar la importación.'],
      [''],
      ['El prompt está disponible con el botón "Copiar prompt para IA" en el modal de importación.'],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    const wsPrompt = XLSX.utils.aoa_to_sheet(promptText);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Preguntas');
    XLSX.utils.book_append_sheet(wb, wsPrompt, 'Prompt para IA');
    XLSX.writeFile(wb, 'plantilla_banco_preguntas.xlsx');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div
        className="relative mx-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
            {t('importar_titulo')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] mb-4">{t('importar_desc')}</p>

        {/* Actions: download template + copy prompt + paste from AI */}
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-brand-gold)] hover:underline"
          >
            <Download className="size-4" />
            {t('descargar_plantilla')}
          </button>
          <button
            type="button"
            onClick={() => {
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
- open_ended → Pregunta de desarrollo
- fill_blank → Completar espacio en blanco
- matching → Emparejamiento de conceptos

COLUMNA "opciones":
- Para single_choice y multiple_choice: las opciones separadas por | (pipe). Ejemplo: Opción A|Opción B|Opción C|Opción D
- Para true_false: dejar vacío
- Para open_ended: respuesta modelo (opcional)
- Para fill_blank: respuestas válidas separadas por |
- Para matching: pares alternados concepto|definición|concepto|definición

COLUMNA "correcta":
- Para single_choice: número de la opción correcta (1, 2, 3...)
- Para multiple_choice: números separados por coma (1,3,4)
- Para true_false: "verdadero" o "falso"
- Para open_ended y matching: dejar vacío

COLUMNA "dificultad": easy, medium, hard (o vacío si no estás seguro)

EJEMPLO COMPLETO:
tipo;pregunta;opciones;correcta;explicacion;materia;categoria;tags;dificultad
single_choice;¿Qué establece el artículo 2465 del CC?;El deudor responde solo con su persona|El acreedor persigue solo bienes raíces|El deudor responde con bienes donados|El acreedor persigue todos los bienes excepto no embargables;4;El art. 2465 establece el derecho de prenda general;Derecho Civil;Obligaciones;art. 2465,prenda general;medium
true_false;¿La compraventa es un contrato bilateral?;;verdadero;Genera obligaciones recíprocas;Derecho Civil;Contratos;compraventa,bilateral;easy
matching;Empareja tipos de plazos con sus características;Plazo determinado|Conocido y específico en tiempo|Plazo fatal|Se extingue irrevocablemente el derecho;;Ambos son clasificaciones doctrinarias del plazo;Derecho Civil;Obligaciones;plazos,clasificación;medium

IMPORTANTE: Responde SOLO con el CSV (encabezados + datos). Sin explicaciones, sin texto adicional, sin bloques de código. Solo el CSV puro.

A continuación las preguntas a convertir:
`;
              navigator.clipboard.writeText(prompt).then(() => {
                toast.success(t('prompt_copiado'));
              });
            }}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-brand-gold)] hover:underline"
          >
            <ClipboardCopy className="size-4" />
            {t('copiar_prompt')}
          </button>
        </div>

        {/* Paste from AI option */}
        {!parsedRows.length && !importResult && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowPasteArea(!showPasteArea)}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-gold)] transition-colors"
            >
              {showPasteArea ? '▾' : '▸'} {t('pegar_desde_ia')}
            </button>
            {showPasteArea && (
              <div className="mt-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={t('pegar_desde_ia_placeholder')}
                  rows={6}
                  className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2.5 text-xs font-mono outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                />
                <button
                  type="button"
                  disabled={!pasteText.trim()}
                  onClick={() => handlePasteFromAI(pasteText)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
                >
                  {t('procesar_texto')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* File upload area */}
        {!parsedRows.length && !importResult && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-border)] p-8 text-center transition-colors hover:border-[var(--color-brand-gold)] hover:bg-[var(--color-bg-secondary)]"
          >
            <Upload className="mx-auto size-8 text-[var(--color-text-muted)]" />
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t('arrastra_archivo')}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('formatos_aceptados')}</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {/* Parse errors */}
        {parseErrors.length > 0 && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-3">
            {parseErrors.map((err, i) => (
              <p key={i} className="text-sm text-[var(--color-error)]">{err}</p>
            ))}
          </div>
        )}

        {/* Preview with full editing */}
        {parsedRows.length > 0 && !importResult && (
          <ImportPreview
            rows={parsedRows}
            onChange={setParsedRows}
            onConfirm={() => importMutation.mutate()}
            onCancel={() => { setParsedRows([]); setFileName(''); }}
            loading={importMutation.isPending}
          />
        )}

        {/* Import result */}
        {importResult && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5 text-green-500" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {importResult.success_count} importadas correctamente
              </span>
            </div>
            {importResult.error_count > 0 && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="size-4 text-[var(--color-error)]" />
                  <span className="text-sm font-medium text-[var(--color-error)]">
                    {importResult.error_count} errores
                  </span>
                </div>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-[var(--color-text-secondary)]">
                      <span className="font-medium">{t('fila')} {err.row}:</span> {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
