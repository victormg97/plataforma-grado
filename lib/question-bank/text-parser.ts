/**
 * Smart text parser for question bank — Word document format.
 *
 * Formats supported:
 * 1) Question with roman numeral assertions + lettered options:
 *    1. ¿Pregunta? / Los contratos se caracterizan por:
 *    I.  Afirmación 1
 *    II. Afirmación 2
 *    a. Solo I        ← these are the real options
 *    b. Solo I y II   ← highlighted = correct
 *    • Explicación...
 *
 * 2) Simple lettered options (no roman):
 *    ¿Pregunta?
 *    a. Opción 1
 *    b. Opción 2  ← highlighted = correct
 *    • Explicación...
 *
 * 3) True/False:
 *    ¿Verdadero o falso? Enunciado
 *    Verdadero
 *    Explicación...
 *
 * 4) Matching (table or alternating lines):
 *    Empareja cada concepto...
 *    Concepto\tDefinición
 *
 * 5) Plain options without prefix (heuristic-based)
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

// ─── Regex ───────────────────────────────────────────────────────────────────

const QUESTION_NUMBER_RE = /^\d+[\.\)\-]\s*/;
const OPTION_LETTER_RE = /^[a-h][\.\)\-]\s*/i;
const ROMAN_RE = /^(?:I{1,3}|IV|VI{0,3}|IX|X{1,3})[\.\)\-]\s+/;
const BULLET_RE = /^[•●]\s*/;
const TRUE_FALSE_RE = /verdadero\s*o\s*falso/i;
const MATCHING_RE = /emparej/i;
const QUESTION_START_RE = /^¿/;
const TITLE_RE = /^(?:cuestionario|sección|parte|capítulo|tema)\b/i;
const EXPLANATION_MIN_LEN = 70;

// ─── Types for internal use ──────────────────────────────────────────────────

interface LineInfo {
  text: string;
  highlighted: boolean;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function parseQuestionsFromText(plainText: string, htmlText?: string): ParsedQuestion[] {
  // Build lines with per-line highlight info
  const lines = buildLines(plainText, htmlText);
  const questions: ParsedQuestion[] = [];

  let i = 0;
  while (i < lines.length) {
    const { text } = lines[i];
    if (!text) { i++; continue; }
    if (TITLE_RE.test(text) && !text.includes('?') && !QUESTION_START_RE.test(text)) { i++; continue; }

    const qText = extractQuestionText(text);
    if (!qText) { i++; continue; }

    if (TRUE_FALSE_RE.test(qText)) {
      const r = parseTrueFalse(lines, i + 1, qText);
      questions.push(r.question); i = r.nextIndex;
    } else if (MATCHING_RE.test(qText)) {
      const r = parseMatching(lines, i + 1, qText);
      questions.push(r.question); i = r.nextIndex;
    } else {
      const r = parseChoice(lines, i + 1, qText);
      questions.push(r.question); i = r.nextIndex;
    }
  }
  return questions;
}

// ─── Build lines with highlight info ─────────────────────────────────────────

/**
 * Build an array of {text, highlighted} per line.
 * We parse the HTML to determine which lines contain highlighted spans.
 * Each line's `highlighted` is true ONLY if that specific line's text
 * appears inside a highlighted element in the HTML.
 */
function buildLines(plainText: string, htmlText?: string): LineInfo[] {
  // Normalize text: ensure line breaks before key patterns
  const normalized = preprocessText(plainText);
  const rawLines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (!htmlText || typeof document === 'undefined') {
    return rawLines.map(text => ({ text, highlighted: false }));
  }

  // Extract highlighted line texts from HTML
  const highlightedSet = extractHighlightedLineTexts(htmlText);

  return rawLines.map(text => {
    // Strip any prefix (number, roman, letter) for matching against highlighted set
    const stripped = text
      .replace(QUESTION_NUMBER_RE, '')
      .replace(OPTION_LETTER_RE, '')
      .replace(ROMAN_RE, '')
      .replace(BULLET_RE, '')
      .trim();

    const highlighted = highlightedSet.has(stripped.toLowerCase()) ||
      highlightedSet.has(text.replace(OPTION_LETTER_RE, '').trim().toLowerCase());

    return { text, highlighted };
  });
}

/**
 * Extract the SET of highlighted text snippets from HTML.
 * Only extracts text from elements with explicit yellow/highlight styling.
 * Returns a Set of lowercased texts for O(1) lookup.
 */
function extractHighlightedLineTexts(html: string): Set<string> {
  const div = document.createElement('div');
  div.innerHTML = html;
  const texts = new Set<string>();

  // Target: elements with yellow background or Word's mso-highlight
  const HIGHLIGHT_RE = /background(?:-color)?:\s*(?:yellow|#ffff00|#ff0|rgb\(\s*255,\s*255,\s*0\s*\))/i;
  const WORD_HIGHLIGHT_RE = /mso-highlight:\s*yellow/i;

  div.querySelectorAll('*').forEach(el => {
    const style = el.getAttribute('style') || '';
    if (HIGHLIGHT_RE.test(style) || WORD_HIGHLIGHT_RE.test(style) || el.tagName === 'MARK') {
      const t = (el.textContent || '').trim();
      // Only include reasonable-length texts (single option, not entire paragraphs)
      if (t.length >= 3 && t.length <= 150) {
        texts.add(t.toLowerCase());
      }
    }
  });

  return texts;
}

function preprocessText(text: string): string {
  let r = text;
  // Newline before numbered questions
  r = r.replace(/([^\n])\s+(\d+[\.\)]\s*(?:¿|[A-Z]))/g, '$1\n$2');
  // Newline before roman numerals
  r = r.replace(/([^\n])\s+((?:I{1,3}|IV|VI{0,3}|IX|X{1,3})[\.\)]\s)/g, '$1\n$2');
  // Newline before letter options
  r = r.replace(/([^\n])\s+([a-h][\.\)]\s)/gi, '$1\n$2');
  // Newline before bullets
  r = r.replace(/([^\n])\s*([•●])\s/g, '$1\n$2 ');
  // Newline before ¿
  r = r.replace(/([^\n])\s+(¿)/g, '$1\n$2');
  // Newline before Verdadero/Falso
  r = r.replace(/([^\n])\s+(Verdadero|Falso)(\s|$)/gi, '$1\n$2$3');
  return r;
}

// ─── Choice parser ───────────────────────────────────────────────────────────

function parseChoice(
  lines: LineInfo[], startIdx: number, content: string
): { question: ParsedQuestion; nextIndex: number } {
  let i = startIdx;
  const options: string[] = [];
  const correctIndices: number[] = [];
  const explanationLines: string[] = [];
  const romanLines: string[] = [];

  // Collect body lines until next question
  const body: LineInfo[] = [];
  while (i < lines.length) {
    if (isQuestionStart(lines[i].text)) break;
    body.push(lines[i]);
    i++;
  }

  // Classify each body line
  let doneOptions = false;
  for (const line of body) {
    const { text, highlighted } = line;

    if (doneOptions) {
      explanationLines.push(BULLET_RE.test(text) ? text.replace(BULLET_RE, '').trim() : text);
      continue;
    }

    // Roman numeral line → part of the question content (assertions)
    if (ROMAN_RE.test(text)) {
      romanLines.push(text);
      continue;
    }

    // Letter option (a. b. c. d.) → real answer option
    if (OPTION_LETTER_RE.test(text)) {
      const optText = text.replace(OPTION_LETTER_RE, '').trim();
      options.push(optText);
      if (highlighted) {
        correctIndices.push(options.length - 1);
      }
      continue;
    }

    // Bullet → explanation starts
    if (BULLET_RE.test(text)) {
      doneOptions = true;
      explanationLines.push(text.replace(BULLET_RE, '').trim());
      continue;
    }

    // If we already have options and hit a non-option line → explanation
    if (options.length > 0) {
      doneOptions = true;
      explanationLines.push(text);
      continue;
    }

    // No options yet, no roman, no letter prefix → could be unprefixed option or assertion
    // Use heuristic: if it's long, it's explanation; if short, it's an option
    if (text.length > EXPLANATION_MIN_LEN && looksLikeExplanation(text)) {
      doneOptions = true;
      explanationLines.push(text);
    } else {
      // Treat as unprefixed option
      options.push(text);
      if (highlighted) {
        correctIndices.push(options.length - 1);
      }
    }
  }

  // Append roman lines to question content
  if (romanLines.length > 0) {
    content = content + '\n' + romanLines.join('\n');
  }

  // If only 1 correct answer → single_choice; if multiple → multiple_choice
  const type = options.length > 0
    ? (correctIndices.length > 1 ? 'multiple_choice' : 'single_choice')
    : 'open_ended';

  return {
    question: { type, content, options, correctIndices, matchingPairs: [], trueFalseAnswer: null, explanation: explanationLines.join('\n') },
    nextIndex: i,
  };
}

// ─── True/False parser ───────────────────────────────────────────────────────

function parseTrueFalse(lines: LineInfo[], startIdx: number, content: string): { question: ParsedQuestion; nextIndex: number } {
  let i = startIdx;
  let answer: boolean | null = null;
  const explanationLines: string[] = [];

  let statement = content;
  const tfMatch = content.match(/^¿?verdadero\s*o\s*falso\??\s*/i);
  if (tfMatch) statement = content.slice(tfMatch[0].length).trim();

  if (!statement && i < lines.length) {
    const next = lines[i].text;
    if (!isQuestionStart(next) && !/^(verdadero|falso)$/i.test(next)) {
      statement = next; i++;
    }
  }

  while (i < lines.length) {
    const { text } = lines[i];
    if (isQuestionStart(text)) break;
    if (/^verdadero$/i.test(text)) { answer = true; i++; continue; }
    if (/^falso$/i.test(text)) { answer = false; i++; continue; }
    if (BULLET_RE.test(text)) { explanationLines.push(text.replace(BULLET_RE, '').trim()); i++; continue; }
    if (answer !== null) { explanationLines.push(text); i++; continue; }
    i++;
  }

  return {
    question: { type: 'true_false', content: statement || content, options: [], correctIndices: [], matchingPairs: [], trueFalseAnswer: answer, explanation: explanationLines.join('\n') },
    nextIndex: i,
  };
}

// ─── Matching parser ─────────────────────────────────────────────────────────

function parseMatching(lines: LineInfo[], startIdx: number, content: string): { question: ParsedQuestion; nextIndex: number } {
  let i = startIdx;
  const pairs: Array<{ left: string; right: string }> = [];
  const explanationLines: string[] = [];
  let parsingExplanation = false;

  while (i < lines.length) {
    const { text } = lines[i];
    if (isQuestionStart(text)) break;

    if (text.includes('\t')) {
      const parts = text.split('\t').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) { pairs.push({ left: parts[0], right: parts[1] }); i++; continue; }
    }
    if (BULLET_RE.test(text)) { parsingExplanation = true; explanationLines.push(text.replace(BULLET_RE, '').trim()); i++; continue; }
    if (parsingExplanation) { explanationLines.push(text); i++; continue; }

    if (i + 1 < lines.length) {
      const next = lines[i + 1].text;
      if (next && !isQuestionStart(next) && !BULLET_RE.test(next) && !next.includes('\t')) {
        pairs.push({ left: text, right: next }); i += 2; continue;
      }
    }
    i++;
  }

  return {
    question: { type: 'matching', content, options: [], correctIndices: [], matchingPairs: pairs, trueFalseAnswer: null, explanation: explanationLines.join('\n') },
    nextIndex: i,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractQuestionText(line: string): string | null {
  const isNumbered = QUESTION_NUMBER_RE.test(line);
  const stripped = isNumbered ? line.replace(QUESTION_NUMBER_RE, '').trim() : line;

  if (isNumbered && (stripped.includes('?') || stripped.includes(':') || stripped.length > 20)) return stripped;
  if (QUESTION_START_RE.test(line) && line.includes('?')) return line;
  if (MATCHING_RE.test(line) && (line.includes('.') || line.includes('?'))) return line;
  return null;
}

function isQuestionStart(line: string): boolean {
  return !!line && extractQuestionText(line) !== null;
}

function looksLikeExplanation(line: string): boolean {
  if (/:\s*.{20,}/.test(line)) return true;
  if (line.endsWith('.')) return true;
  if (/\b(ya que|debido a|lo que|por lo tanto|en contraste|porque|implica que|se caracteriza|se define)\b/i.test(line)) return true;
  return false;
}
