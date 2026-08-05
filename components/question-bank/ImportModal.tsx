'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Upload, Download, AlertCircle, CheckCircle, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/common/Button';
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
      ['INSTRUCCIONES PARA IA — Conversión de preguntas a formato de importación'],
      [''],
      ['Eres un asistente que transforma preguntas de derecho a formato CSV/Excel para importar a un banco de preguntas.'],
      [''],
      ['FORMATO REQUERIDO (columnas separadas por tabulación):'],
      ['tipo | pregunta | opciones | correcta | explicacion | materia | categoria | tags | dificultad'],
      [''],
      ['TIPOS VÁLIDOS:'],
      ['- single_choice: Selección única. Opciones separadas por ";". Correcta = número de la opción (1,2,3...)'],
      ['- multiple_choice: Selección múltiple. Opciones separadas por ";". Correcta = números separados por "," (ej: 1,3)'],
      ['- true_false: Verdadero/Falso. Opciones vacío. Correcta = "verdadero" o "falso"'],
      ['- open_ended: Desarrollo. Opciones = respuesta modelo (opcional). Correcta vacío.'],
      ['- fill_blank: Completar espacio. La pregunta usa ___ para el espacio. Opciones = respuestas válidas separadas por ";"'],
      ['- matching: Emparejamiento. Opciones = pares alternados "concepto1;definición1;concepto2;definición2". Correcta vacío.'],
      [''],
      ['REGLAS:'],
      ['- Materia: clasificación general (ej: Derecho Civil, Derecho Penal). Puede quedar vacío.'],
      ['- Categoría: subcategoría dentro de la materia (ej: Contratos, Obligaciones). Puede quedar vacío.'],
      ['- Tags: palabras clave separadas por coma. Puede quedar vacío.'],
      ['- Dificultad: "easy", "medium", "hard", o vacío si no se sabe.'],
      ['- Si la respuesta correcta está resaltada/subrayada/en negrita en el texto original, identifícala.'],
      ['- Explicación: breve justificación de la respuesta correcta. Puede quedar vacío.'],
      [''],
      ['EJEMPLO DE ENTRADA:'],
      ['2. ¿Qué establece el artículo 2465 del Código Civil?'],
      ['a) El deudor responde solo con su persona.'],
      ['b) El acreedor puede perseguir solo los bienes raíces.'],
      ['c) El deudor solo responde con los bienes donados.'],
      ['d) El acreedor puede perseguir la ejecución sobre todos los bienes del deudor, excepto los no embargables. [CORRECTA]'],
      [''],
      ['EJEMPLO DE SALIDA:'],
      ['single_choice\t¿Qué establece el artículo 2465 del Código Civil?\tEl deudor responde solo con su persona;El acreedor puede perseguir solo los bienes raíces;El deudor solo responde con los bienes donados;El acreedor puede perseguir la ejecución sobre todos los bienes del deudor, excepto los no embargables\t4\t\tDerecho Civil\tDerecho de prenda general\tart. 2465,prenda general\t'],
      [''],
      ['Ahora convierte las siguientes preguntas al formato descrito. Responde SOLO con las filas de datos (sin encabezados), una pregunta por línea, separadas por tabulación:'],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    const wsPrompt = XLSX.utils.aoa_to_sheet(promptText);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Preguntas');
    XLSX.utils.book_append_sheet(wb, wsPrompt, 'Prompt para IA');
    XLSX.writeFile(wb, 'plantilla_banco_preguntas.xlsx');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative mx-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl"
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

        {/* Actions: download template + copy prompt */}
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
              const prompt = `Eres un asistente que transforma preguntas de derecho a formato CSV/Excel para importar a un banco de preguntas.

FORMATO REQUERIDO (columnas separadas por tabulación):
tipo\tpregunta\topciones\tcorrecta\texplicacion\tmateria\tcategoria\ttags\tdificultad

TIPOS VÁLIDOS:
- single_choice: Selección única. Opciones separadas por ";". Correcta = número de la opción (1,2,3...)
- multiple_choice: Selección múltiple. Opciones separadas por ";". Correcta = números separados por "," (ej: 1,3)
- true_false: Verdadero/Falso. Opciones vacío. Correcta = "verdadero" o "falso"
- open_ended: Desarrollo. Opciones = respuesta modelo (opcional). Correcta vacío.
- fill_blank: Completar espacio. La pregunta usa ___ para el espacio. Opciones = respuestas válidas separadas por ";"
- matching: Emparejamiento. Opciones = pares alternados "concepto1;definición1;concepto2;definición2". Correcta vacío.

REGLAS:
- Materia: clasificación general (ej: Derecho Civil, Derecho Penal). Puede quedar vacío.
- Categoría: subcategoría dentro de la materia (ej: Contratos, Obligaciones). Puede quedar vacío.
- Tags: palabras clave separadas por coma. Puede quedar vacío.
- Dificultad: "easy", "medium", "hard", o vacío si no se sabe.
- Si la respuesta correcta está resaltada/subrayada/en negrita en el texto original, identifícala.
- Explicación: breve justificación de la respuesta correcta. Puede quedar vacío.

EJEMPLO DE ENTRADA:
2. ¿Qué establece el artículo 2465 del Código Civil?
a) El deudor responde solo con su persona.
b) El acreedor puede perseguir solo los bienes raíces.
c) El deudor solo responde con los bienes donados.
d) El acreedor puede perseguir la ejecución sobre todos los bienes del deudor, excepto los no embargables. [CORRECTA]

EJEMPLO DE SALIDA:
single_choice\t¿Qué establece el artículo 2465 del Código Civil?\tEl deudor responde solo con su persona;El acreedor puede perseguir solo los bienes raíces;El deudor solo responde con los bienes donados;El acreedor puede perseguir la ejecución sobre todos los bienes del deudor, excepto los no embargables\t4\t\tDerecho Civil\tDerecho de prenda general\tart. 2465,prenda general\t

Ahora convierte las siguientes preguntas al formato descrito. Responde SOLO con las filas de datos (sin encabezados), una pregunta por línea, separadas por tabulación:`;
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

        {/* Preview */}
        {parsedRows.length > 0 && !importResult && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
              {t('vista_previa')} ({parsedRows.length} {parsedRows.length === 1 ? 'fila' : 'filas'})
            </h3>
            <div className="max-h-[300px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-muted)]">#</th>
                    <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-muted)]">Tipo</th>
                    <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-muted)]">Pregunta</th>
                    <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-muted)]">Categoría</th>
                    <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-muted)]">Dificultad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {parsedRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{i + 1}</td>
                      <td className="px-2 py-1.5">{row.type}</td>
                      <td className="px-2 py-1.5 max-w-[200px] truncate">{row.content}</td>
                      <td className="px-2 py-1.5">{row.category}</td>
                      <td className="px-2 py-1.5">{row.difficulty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => { setParsedRows([]); setFileName(''); }}>
                Cancelar
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                loading={importMutation.isPending}
              >
                {importMutation.isPending ? t('importando') : t('importar_confirmar')}
              </Button>
            </div>
          </div>
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
