/**
 * Import validation helper for question bank.
 *
 * Validates that all selected questions have the required answers
 * before allowing import. Reports specific issues so the user
 * can navigate to and fix them.
 */

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

export interface ValidationIssue {
  /** 1-based index of the question in the full list */
  questionNumber: number;
  /** Type of issue */
  issueType: 'no_correct_answer' | 'no_true_false_answer' | 'no_options';
  /** Brief description of the issue */
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  /** Total number of questions that will be imported */
  totalSelected: number;
  /** Number of questions with issues */
  issueCount: number;
}

/**
 * Validate that all selected questions have proper answers set.
 *
 * @param rows All import rows
 * @param selected Set of selected row indices (0-based)
 * @returns ValidationResult with issues if any
 */
export function validateImportRows(rows: ImportRow[], selected: Set<number>): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const idx of Array.from(selected).sort((a, b) => a - b)) {
    const row = rows[idx];
    if (!row) continue;

    const questionNumber = idx + 1; // 1-based for display
    const type = row.type?.trim().toLowerCase();

    if (type === 'single_choice' || type === 'multiple_choice') {
      // Must have options
      const opts = row.options?.split('|||').filter(Boolean);
      if (!opts || opts.length < 2) {
        issues.push({
          questionNumber,
          issueType: 'no_options',
          message: `Pregunta #${questionNumber}: sin opciones de respuesta`,
        });
        continue;
      }

      // Must have at least one correct answer
      const correctIndices = row.correct?.split(',').map(c => parseInt(c.trim())).filter(n => !isNaN(n) && n >= 1);
      if (!correctIndices || correctIndices.length === 0) {
        issues.push({
          questionNumber,
          issueType: 'no_correct_answer',
          message: `Pregunta #${questionNumber}: sin respuesta correcta marcada`,
        });
      }
    } else if (type === 'true_false') {
      const answer = row.correct?.trim().toLowerCase();
      if (answer !== 'verdadero' && answer !== 'falso' && answer !== 'true' && answer !== 'false') {
        issues.push({
          questionNumber,
          issueType: 'no_true_false_answer',
          message: `Pregunta #${questionNumber}: sin respuesta verdadero/falso marcada`,
        });
      }
    }
    // open_ended and matching don't require a "correct" answer
  }

  return {
    valid: issues.length === 0,
    issues,
    totalSelected: selected.size,
    issueCount: issues.length,
  };
}
