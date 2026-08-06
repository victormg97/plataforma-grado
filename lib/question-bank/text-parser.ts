/**
 * Smart text parser for question bank.
 * Parses pasted Word/document text into structured questions.
 * 
 * Supported patterns:
 * - Numbered questions: "1. ¿Pregunta?" or "1) ¿Pregunta?"
 * - Non-numbered questions starting with ¿
 * - Lettered options: "a) Opción" or "A. Opción" or "a. Opción"
 * - True/False: detects "¿Verdadero o falso?" prefix, answer is "Verdadero" or "Falso"
 * - Matching/Emparejamiento: detects "Empareja" keyword + pairs
 * - Explanation: bullet points (•, ●, -, *) or regular paragraphs after options
 * - Correct answer: highlighted text (HTML background-color) on an option
 * 
 * Document format from Word:
 * Questions are separated by their structure: question text followed by
 * options (a-d) or Verdadero/Falso, then explanation paragraphs.
 */

export interface ParsedQuestion {
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'open_ended' | 'matching';
  content: string;
  options: string[];
  correctIndices: number[];
  matchingPairs: Array<{ left: string; right: string }>;
  trueFalseAnswer: boolean | null;
  explanation: string;
}

// Regex patterns
const QUESTION_NUMBER_RE = /^\d+[\.\)\-]\s*/;
const OPTION_PREFIX_RE = /^[a-dA-D][\.\)\-]\s*/;
const BULLET_RE = /^[•●\-\*]\s*/;
const TRUE_FALSE_RE = /verdadero\s*o\s*falso|verdadero\s*\/\s*falso/i;
const MATCHING_RE = /emparej/i;
const QUESTION_START_RE = /^¿/;

// Title/section header patterns (e.g., "Cuestionario Contratos parte general")
const TITLE_RE = /^(?:cuestionario|sección|parte|capítulo|tema)\b/i;

export function parseQuestionsFromText(plainText: string, htmlText?: string): ParsedQuestion[] {
  const lines = plainText.split('\n').map(l => l.trim());
  const questions: ParsedQuestion[] = [];

  // Detect highlighted lines from HTML (correct answers)
  const highlightedTexts = htmlText ? extractHighlightedTexts(htmlText) : [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines and section titles
    if (!line) { i++; continue; }
    if (TITLE_RE.test(line) && !line.includes('?') && !QUESTION_START_RE.test(line)) { i++; continue; }

    // Detect question start
    const isNumbered = QUESTION_NUMBER_RE.test(line);
    const startsWithQuestion = QUESTION_START_RE.test(line);
    const questionText = isNumbered ? line.replace(QUESTION_NUMBER_RE, '').trim() : line;

    // Check if this line looks like a question
    const isQuestion = (isNumbered && (questionText.includes('?') || questionText.length > 15))
      || (startsWithQuestion && questionText.includes('?'));

    if (!isQuestion) { i++; continue; }

    // Determine question type and parse accordingly
    if (TRUE_FALSE_RE.test(questionText)) {
      const result = parseTrueFalse(lines, i + 1, questionText);
      questions.push(result.question);
      i = result.nextIndex;
    } else if (MATCHING_RE.test(questionText)) {
      const result = parseMatching(lines, i + 1, questionText);
      questions.push(result.question);
      i = result.nextIndex;
    } else {
      const result = parseChoiceQuestion(lines, i + 1, questionText, highlightedTexts);
      questions.push(result.question);
      i = result.nextIndex;
    }
  }

  return questions;
}

function parseTrueFalse(lines: string[], startIdx: number, content: string): { question: ParsedQuestion; nextIndex: number } {
  let i = startIdx;
  let answer: boolean | null = null;
  const explanationLines: string[] = [];

  // The content might include "¿Verdadero o falso?" prefix — extract the actual statement
  // Some formats: "¿Verdadero o falso? Enunciado..."
  let statement = content;
  const tfMatch = content.match(/^¿?verdadero\s*o\s*falso\??\s*/i);
  if (tfMatch) {
    statement = content.slice(tfMatch[0].length).trim();
  }

  // If statement is empty, the next line is the actual statement
  if (!statement) {
    while (i < lines.length && !lines[i]) i++;
    if (i < lines.length && !isNextQuestionStart(lines[i]) && !/^(verdadero|falso)$/i.test(lines[i])) {
      statement = lines[i];
      i++;
    }
  }

  // Look for "Verdadero" or "Falso" answer on its own line
  while (i < lines.length) {
    const line = lines[i];
    if (!line) { i++; continue; }

    if (/^verdadero$/i.test(line)) { answer = true; i++; continue; }
    if (/^falso$/i.test(line)) { answer = false; i++; continue; }

    // Bullet = explanation
    if (BULLET_RE.test(line)) {
      explanationLines.push(line.replace(BULLET_RE, '').trim());
      i++;
      continue;
    }

    // If we already have the answer, remaining text until next question is explanation
    if (answer !== null && !isNextQuestionStart(line)) {
      explanationLines.push(line);
      i++;
      continue;
    }

    // Hit next question
    if (isNextQuestionStart(line)) break;

    i++;
  }

  // Use the statement (without the "¿Verdadero o falso?" prefix) as content
  const finalContent = statement || content;

  return {
    question: {
      type: 'true_false',
      content: finalContent,
      options: [],
      correctIndices: [],
      matchingPairs: [],
      trueFalseAnswer: answer,
      explanation: explanationLines.join('\n'),
    },
    nextIndex: i,
  };
}

function parseMatching(lines: string[], startIdx: number, content: string): { question: ParsedQuestion; nextIndex: number } {
  let i = startIdx;
  const pairs: Array<{ left: string; right: string }> = [];
  const explanationLines: string[] = [];
  let parsingExplanation = false;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) { i++; continue; }
    if (isNextQuestionStart(line)) break;

    // Tab-separated pair (from table paste)
    if (line.includes('\t')) {
      const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        pairs.push({ left: parts[0], right: parts[1] });
        i++;
        continue;
      }
    }

    // Bullet = explanation
    if (BULLET_RE.test(line)) {
      parsingExplanation = true;
      explanationLines.push(line.replace(BULLET_RE, '').trim());
      i++;
      continue;
    }

    if (parsingExplanation) {
      explanationLines.push(line);
      i++;
      continue;
    }

    // Alternating lines: concept then definition
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && !isNextQuestionStart(nextLine) && !BULLET_RE.test(nextLine) && !nextLine.includes('\t')) {
        pairs.push({ left: line, right: nextLine });
        i += 2;
        continue;
      }
    }

    // Single line that doesn't match — skip
    i++;
  }

  return {
    question: {
      type: 'matching',
      content,
      options: [],
      correctIndices: [],
      matchingPairs: pairs,
      trueFalseAnswer: null,
      explanation: explanationLines.join('\n'),
    },
    nextIndex: i,
  };
}

function parseChoiceQuestion(
  lines: string[],
  startIdx: number,
  content: string,
  highlightedTexts: string[]
): { question: ParsedQuestion; nextIndex: number } {
  let i = startIdx;
  const options: string[] = [];
  const correctIndices: number[] = [];
  const explanationLines: string[] = [];
  let parsingOptions = true;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) { i++; continue; }
    if (isNextQuestionStart(line)) break;

    if (parsingOptions && OPTION_PREFIX_RE.test(line)) {
      const optText = line.replace(OPTION_PREFIX_RE, '').trim();
      options.push(optText);

      // Check if this option is highlighted (correct)
      if (isHighlighted(optText, highlightedTexts)) {
        correctIndices.push(options.length - 1);
      }
      i++;
    } else if (BULLET_RE.test(line)) {
      parsingOptions = false;
      explanationLines.push(line.replace(BULLET_RE, '').trim());
      i++;
    } else if (!parsingOptions) {
      // After options, non-bullet text is also explanation
      explanationLines.push(line);
      i++;
    } else if (parsingOptions && options.length > 0) {
      // We have options already but this line isn't an option — it's explanation
      parsingOptions = false;
      explanationLines.push(line);
      i++;
    } else {
      // No options yet and not an option prefix — might be continuation or explanation
      // If the line is long enough, treat as explanation
      if (line.length > 20) {
        parsingOptions = false;
        explanationLines.push(line);
      }
      i++;
    }
  }

  return {
    question: {
      type: options.length > 0 ? 'single_choice' : 'open_ended',
      content,
      options,
      correctIndices,
      matchingPairs: [],
      trueFalseAnswer: null,
      explanation: explanationLines.join('\n'),
    },
    nextIndex: i,
  };
}

/**
 * Checks if a line looks like the start of a new question.
 * Handles both numbered (1. ¿...?) and non-numbered (¿...?) patterns.
 */
function isNextQuestionStart(line: string): boolean {
  if (!line) return false;
  // Numbered question
  if (QUESTION_NUMBER_RE.test(line)) {
    const stripped = line.replace(QUESTION_NUMBER_RE, '').trim();
    return stripped.includes('?') || stripped.length > 15;
  }
  // Non-numbered question starting with ¿
  if (QUESTION_START_RE.test(line) && line.includes('?')) return true;
  return false;
}

function isHighlighted(optionText: string, highlightedTexts: string[]): boolean {
  if (highlightedTexts.length === 0) return false;
  const optClean = optionText.toLowerCase().trim();
  return highlightedTexts.some(ht => {
    const htClean = ht.toLowerCase().trim();
    // Fuzzy match: one contains the other (handles partial highlighting)
    return optClean.includes(htClean) || htClean.includes(optClean);
  });
}

function extractHighlightedTexts(html: string): string[] {
  if (typeof document === 'undefined') return [];
  const div = document.createElement('div');
  div.innerHTML = html;

  const highlighted: string[] = [];
  const elements = div.querySelectorAll('*');

  elements.forEach(el => {
    const style = el.getAttribute('style') || '';
    // Detect various highlight patterns from Word paste
    const hasHighlight =
      /background-color:\s*(?:yellow|#ff(?:ff00|f[0-9a-f]{2})|rgb\(255,\s*255,\s*0\))/i.test(style) ||
      /background(?:-color)?:\s*(?!transparent|white|#fff|inherit|initial|none)/i.test(style) ||
      el.tagName === 'MARK';

    if (hasHighlight) {
      const text = (el.textContent || '').trim();
      if (text && text.length > 3) highlighted.push(text);
    }
  });

  return highlighted;
}
