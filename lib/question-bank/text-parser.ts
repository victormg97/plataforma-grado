/**
 * Smart text parser for question bank.
 * Parses pasted Word/document text into structured questions.
 *
 * Supported document formats:
 *
 * 1) Choice with letter prefixes:
 *    ¿Pregunta?
 *    a) Opción 1
 *    b) Opción 2  ← highlighted = correcta
 *    c) Opción 3
 *    • Explicación...
 *
 * 2) Choice with roman numeral assertions + letter options:
 *    ¿Pregunta?
 *    I.  Afirmación 1
 *    II. Afirmación 2
 *    a) Solo I
 *    b) Solo I y II  ← highlighted
 *    • Explicación...
 *
 * 3) Choice without any prefix (plain lines):
 *    ¿Pregunta?
 *    Opción 1
 *    Opción 2
 *    Opción 3
 *    Explicación larga...
 *
 * 4) True/False:
 *    ¿Verdadero o falso? Enunciado
 *    Verdadero
 *    Explicación...
 *
 * 5) Matching:
 *    Empareja cada concepto con su descripción.
 *    Concepto 1 \t Definición 1
 *    Concepto 2 \t Definición 2
 *    (or alternating lines)
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

// ─── Regex patterns ──────────────────────────────────────────────────────────

const QUESTION_NUMBER_RE = /^\d+[\.\)\-]\s*/;
const OPTION_PREFIX_RE = /^[a-hA-H][\.\)\-]\s*/;
const ROMAN_PREFIX_RE = /^(?:I{1,3}|IV|VI{0,3}|IX|X{0,3})[\.\)\-]\s*/i;
const BULLET_RE = /^[•●]\s*/;
const TRUE_FALSE_RE = /verdadero\s*o\s*falso|verdadero\s*\/\s*falso/i;
const MATCHING_RE = /emparej/i;
const QUESTION_START_RE = /^¿/;
const TITLE_RE = /^(?:cuestionario|sección|parte|capítulo|tema)\b/i;

// Heuristic thresholds
const EXPLANATION_MIN_LENGTH = 70;

// ─── Main entry point ────────────────────────────────────────────────────────

export function parseQuestionsFromText(plainText: string, htmlText?: string): ParsedQuestion[] {
  // Preprocess: insert line breaks before patterns that should be on their own line
  const normalized = preprocessText(plainText);
  const lines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const questions: ParsedQuestion[] = [];
  const highlightedTexts = htmlText ? extractHighlightedTexts(htmlText) : [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip section titles
    if (TITLE_RE.test(line) && !line.includes('?') && !QUESTION_START_RE.test(line)) {
      i++;
      continue;
    }

    // Detect question start
    const questionText = extractQuestionText(line);
    if (!questionText) { i++; continue; }

    // Determine question type and parse
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

// ─── True/False ──────────────────────────────────────────────────────────────

function parseTrueFalse(lines: string[], startIdx: number, content: string): { question: ParsedQuestion; nextIndex: number } {
  let i = startIdx;
  let answer: boolean | null = null;
  const explanationLines: string[] = [];

  // Extract the actual statement from "¿Verdadero o falso? Enunciado..."
  let statement = content;
  const tfMatch = content.match(/^¿?verdadero\s*o\s*falso\??\s*/i);
  if (tfMatch) {
    statement = content.slice(tfMatch[0].length).trim();
  }

  // If statement is empty, the next line is the actual statement
  if (!statement && i < lines.length) {
    if (!isNextQuestionStart(lines[i]) && !/^(verdadero|falso)$/i.test(lines[i])) {
      statement = lines[i];
      i++;
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    if (isNextQuestionStart(line)) break;

    if (/^verdadero$/i.test(line)) { answer = true; i++; continue; }
    if (/^falso$/i.test(line)) { answer = false; i++; continue; }

    if (BULLET_RE.test(line)) {
      explanationLines.push(line.replace(BULLET_RE, '').trim());
      i++; continue;
    }

    if (answer !== null) { explanationLines.push(line); i++; continue; }
    i++;
  }

  return {
    question: {
      type: 'true_false',
      content: statement || content,
      options: [],
      correctIndices: [],
      matchingPairs: [],
      trueFalseAnswer: answer,
      explanation: explanationLines.join('\n'),
    },
    nextIndex: i,
  };
}

// ─── Matching ────────────────────────────────────────────────────────────────

function parseMatching(lines: string[], startIdx: number, content: string): { question: ParsedQuestion; nextIndex: number } {
  let i = startIdx;
  const pairs: Array<{ left: string; right: string }> = [];
  const explanationLines: string[] = [];
  let parsingExplanation = false;

  while (i < lines.length) {
    const line = lines[i];
    if (isNextQuestionStart(line)) break;

    // Tab-separated pair (from table paste)
    if (line.includes('\t')) {
      const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        pairs.push({ left: parts[0], right: parts[1] });
        i++; continue;
      }
    }

    // Bullet = explanation start
    if (BULLET_RE.test(line)) {
      parsingExplanation = true;
      explanationLines.push(line.replace(BULLET_RE, '').trim());
      i++; continue;
    }

    if (parsingExplanation) { explanationLines.push(line); i++; continue; }

    // Alternating lines: concept then definition
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (nextLine && !isNextQuestionStart(nextLine) && !BULLET_RE.test(nextLine) && !nextLine.includes('\t')) {
        pairs.push({ left: line, right: nextLine });
        i += 2; continue;
      }
    }

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

// ─── Choice Question ─────────────────────────────────────────────────────────

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

  // Collect all body lines until next question
  const bodyLines: string[] = [];
  while (i < lines.length) {
    if (isNextQuestionStart(lines[i])) break;
    bodyLines.push(lines[i]);
    i++;
  }

  // Check what structure the body has
  const hasRomanPrefixes = bodyLines.some(l => ROMAN_PREFIX_RE.test(l));
  // Only consider letter prefixes on lines that are NOT roman numerals
  const hasLetterPrefixes = bodyLines.some(l => OPTION_PREFIX_RE.test(l) && !ROMAN_PREFIX_RE.test(l));

  if (hasLetterPrefixes) {
    // Pattern: possibly roman numeral assertions + lettered options + explanation
    // Roman numerals (I., II., III.) are part of the question context (assertions),
    // lettered lines (a., b., c.) are the actual answer options.
    const romanLines: string[] = [];
    let parsingOptions = false;
    let doneOptions = false;

    for (const line of bodyLines) {
      if (doneOptions) {
        // Everything after options is explanation
        if (BULLET_RE.test(line)) {
          explanationLines.push(line.replace(BULLET_RE, '').trim());
        } else {
          explanationLines.push(line);
        }
        continue;
      }

      // Check roman FIRST (I., II., III., IV.) — these are assertions, not options
      if (ROMAN_PREFIX_RE.test(line) && !parsingOptions) {
        romanLines.push(line);
        continue;
      }

      if (OPTION_PREFIX_RE.test(line) && !ROMAN_PREFIX_RE.test(line)) {
        parsingOptions = true;
        const optText = line.replace(OPTION_PREFIX_RE, '').trim();
        options.push(optText);
        if (isHighlighted(optText, highlightedTexts)) {
          correctIndices.push(options.length - 1);
        }
      } else if (parsingOptions) {
        // We were parsing options but this line doesn't have a prefix — done with options
        doneOptions = true;
        if (BULLET_RE.test(line)) {
          explanationLines.push(line.replace(BULLET_RE, '').trim());
        } else {
          explanationLines.push(line);
        }
      } else if (BULLET_RE.test(line)) {
        doneOptions = true;
        explanationLines.push(line.replace(BULLET_RE, '').trim());
      } else {
        // Other line before options — could be assertion text without roman prefix
        romanLines.push(line);
      }
    }

    // If we found roman assertions, append them to the question content
    if (romanLines.length > 0) {
      content = content + '\n' + romanLines.join('\n');
    }
  } else {
    // No letter prefixes — use heuristic to split options vs explanation
    parseUnprefixedOptions(bodyLines, options, explanationLines, correctIndices, highlightedTexts);
  }

  const type = options.length > 0 ? 'single_choice' : 'open_ended';

  return {
    question: { type, content, options, correctIndices, matchingPairs: [], trueFalseAnswer: null, explanation: explanationLines.join('\n') },
    nextIndex: i,
  };
}

// ─── Unprefixed options heuristic ────────────────────────────────────────────

/**
 * Parse options from lines WITHOUT letter prefixes.
 * Uses length heuristics to distinguish short option lines from long explanation lines.
 */
function parseUnprefixedOptions(
  bodyLines: string[],
  options: string[],
  explanationLines: string[],
  correctIndices: number[],
  highlightedTexts: string[]
): void {
  if (bodyLines.length === 0) return;

  // Find the transition point where options end and explanations begin.
  let transitionIdx = bodyLines.length;

  for (let j = 0; j < bodyLines.length; j++) {
    const line = bodyLines[j];
    const len = line.length;

    // Bullet point → definitely explanation from here
    if (BULLET_RE.test(line)) {
      transitionIdx = j;
      break;
    }

    // Long line that looks like an explanation sentence
    if (len > EXPLANATION_MIN_LENGTH && looksLikeExplanation(line)) {
      transitionIdx = j;
      break;
    }

    // After 2+ short lines, if current line is much longer → transition
    if (j >= 2) {
      const avgPrevLen = bodyLines.slice(0, j).reduce((sum, l) => sum + l.length, 0) / j;
      if (len > avgPrevLen * 2.5 && len > 55) {
        transitionIdx = j;
        break;
      }
    }
  }

  // Ensure at least 2 options for it to make sense as a choice question
  if (transitionIdx < 2) {
    // If fewer than 2 options, treat everything as explanation (open_ended)
    for (const line of bodyLines) {
      explanationLines.push(BULLET_RE.test(line) ? line.replace(BULLET_RE, '').trim() : line);
    }
    return;
  }

  // Split into options and explanations
  for (let j = 0; j < transitionIdx; j++) {
    const line = bodyLines[j];
    const cleanLine = BULLET_RE.test(line) ? line.replace(BULLET_RE, '').trim() : line;
    options.push(cleanLine);
    if (isHighlighted(cleanLine, highlightedTexts)) {
      correctIndices.push(options.length - 1);
    }
  }

  for (let j = transitionIdx; j < bodyLines.length; j++) {
    const line = bodyLines[j];
    explanationLines.push(BULLET_RE.test(line) ? line.replace(BULLET_RE, '').trim() : line);
  }
}

/**
 * Heuristic: does this line look like an explanation sentence?
 */
function looksLikeExplanation(line: string): boolean {
  if (/:\s*.{20,}/.test(line)) return true;
  if (line.endsWith('.')) return true;
  if (/\b(ya que|debido a|lo que|por lo tanto|en contraste|esto|porque|implica que|se caracteriza|se define|se refiere|se considera)\b/i.test(line)) return true;
  return false;
}

// ─── Preprocessing ───────────────────────────────────────────────────────────

/**
 * Preprocess pasted text to ensure proper line breaks.
 * Word paste sometimes merges lines that should be separate.
 * We insert \n before patterns like:
 * - Numbered questions: "1." "2." etc. when preceded by text
 * - Roman numerals: "I." "II." "III." "IV." etc.
 * - Letter options: "a." "b." "c." etc.
 * - Bullets: "•" 
 * - "¿" (question start)
 * - "Verdadero" / "Falso" as standalone answers
 */
function preprocessText(text: string): string {
  let result = text;
  
  // Insert newline before numbered questions (e.g., "...text1. ¿Pregunta" → "...text\n1. ¿Pregunta")
  result = result.replace(/(?<=\S)\s+(\d+[\.\)]\s*[¿A-Z])/g, '\n$1');
  
  // Insert newline before roman numerals (I. II. III. IV. V. VI. VII. VIII. IX. X.)
  result = result.replace(/(?<=\S)\s+((?:I{1,3}|IV|VI{0,3}|IX|X{1,3})[\.\)]\s)/gi, '\n$1');
  
  // Insert newline before letter options (a. b. c. d. etc.)
  result = result.replace(/(?<=\S)\s+([a-h][\.\)]\s)/gi, '\n$1');
  
  // Insert newline before bullets
  result = result.replace(/(?<=\S)\s*([•●])\s/g, '\n$1 ');
  
  // Insert newline before ¿ (question start) when preceded by text
  result = result.replace(/(?<=\S)\s+(¿)/g, '\n$1');
  
  // Insert newline before standalone "Verdadero" or "Falso"
  result = result.replace(/(?<=\S)\s+(Verdadero|Falso)(?=\s|$)/gi, '\n$1');
  
  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract question text from a line, or return null if not a question.
 */
function extractQuestionText(line: string): string | null {
  const isNumbered = QUESTION_NUMBER_RE.test(line);
  const startsWithQuestion = QUESTION_START_RE.test(line);
  const stripped = isNumbered ? line.replace(QUESTION_NUMBER_RE, '').trim() : line;

  // Numbered line with ? or long enough
  if (isNumbered && (stripped.includes('?') || stripped.length > 20)) {
    return stripped;
  }

  // Non-numbered ¿...?
  if (startsWithQuestion && line.includes('?')) {
    return line;
  }

  // "Empareja..." lines (matching) — may not have ¿ or numbers
  if (MATCHING_RE.test(line) && (line.includes('.') || line.includes('?'))) {
    return line;
  }

  return null;
}

function isNextQuestionStart(line: string): boolean {
  if (!line) return false;
  return extractQuestionText(line) !== null;
}

function isHighlighted(optionText: string, highlightedTexts: string[]): boolean {
  if (highlightedTexts.length === 0) return false;
  const optClean = optionText.toLowerCase().trim();
  if (optClean.length < 3) return false;
  
  return highlightedTexts.some(ht => {
    const htClean = ht.toLowerCase().trim();
    if (htClean.length < 3) return false;
    
    // Exact match
    if (optClean === htClean) return true;
    
    // Near-exact: one starts/ends with the other AND similar length
    // This prevents "Solo I y III" from matching "Solo I" or vice versa broadly
    const lenRatio = Math.min(optClean.length, htClean.length) / Math.max(optClean.length, htClean.length);
    if (lenRatio < 0.5) return false; // Too different in length, can't be the same option
    
    if (htClean.includes(optClean) || optClean.includes(htClean)) return true;
    return false;
  });
}

function extractHighlightedTexts(html: string): string[] {
  if (typeof document === 'undefined') return [];
  const div = document.createElement('div');
  div.innerHTML = html;

  const highlighted: string[] = [];

  // Only look for elements with explicit highlight colors (yellow, lime, etc.)
  // Avoid matching generic background colors from Word's page/cell formatting
  const HIGHLIGHT_COLORS_RE = /background(?:-color)?:\s*(?:yellow|#ffff00|#ff0|rgb\(\s*255,\s*255,\s*0\s*\)|#ffff[0-9a-f]{2}|lime|#00ff00)/i;
  // Also match Word's highlight markup which uses specific named colors
  const WORD_HIGHLIGHT_RE = /mso-highlight:\s*\w+/i;

  const elements = div.querySelectorAll('*');

  elements.forEach(el => {
    const style = el.getAttribute('style') || '';
    const isHighlight = HIGHLIGHT_COLORS_RE.test(style) || WORD_HIGHLIGHT_RE.test(style) || el.tagName === 'MARK';

    if (isHighlight) {
      // Only take direct text content (not nested children which might be broader)
      const text = (el.textContent || '').trim();
      // Filter out very short or very long texts (a highlighted option is typically 5-150 chars)
      if (text.length >= 3 && text.length <= 200) {
        highlighted.push(text);
      }
    }
  });

  return highlighted;
}
