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
const BULLET_RE = /^[•●·\-]\s*/;
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
  // Build highlight lookup from HTML (order-based matching)
  const highlightedTexts = htmlText ? extractHighlightsOrdered(htmlText) : [];

  // Normalize text
  const normalized = preprocessText(plainText);
  const rawLines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Build lines with per-line highlight using ordered consumption
  const lines = matchHighlightsToLines(rawLines, highlightedTexts);

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

// ─── Highlight extraction ────────────────────────────────────────────────────

/**
 * Extract highlighted text snippets from HTML in DOM order.
 * Returns them in sequence so we can consume them one-by-one
 * matching from top to bottom (prevents cross-question matches).
 */
function extractHighlightsOrdered(html: string): string[] {
  if (typeof document === 'undefined') return [];

  const div = document.createElement('div');
  div.innerHTML = html;
  const texts: string[] = [];

  const HIGHLIGHT_RE = /background(?:-color)?:\s*(?:yellow|#ffff00|#ff0|rgb\(\s*255,\s*255,\s*0\s*\))/i;
  const WORD_HIGHLIGHT_RE = /mso-highlight:\s*yellow/i;

  // Walk DOM in document order
  function walk(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const style = el.getAttribute('style') || '';
    const isHighlighted = HIGHLIGHT_RE.test(style) || WORD_HIGHLIGHT_RE.test(style) || el.tagName === 'MARK';

    if (isHighlighted) {
      const t = (el.textContent || '').trim();
      if (t.length >= 3) {
        texts.push(t.toLowerCase());
      }
      return; // Don't descend — already captured entire text
    }

    for (const child of Array.from(el.childNodes)) {
      walk(child);
    }
  }

  walk(div);
  return texts;
}

/**
 * Match highlights to lines using ordered consumption with lookahead.
 * We iterate lines top to bottom. For each line, we check if any of the
 * next few unconsumed highlights match this line's text. We allow a small
 * lookahead window to handle cases where a highlight doesn't match its
 * immediately expected line (e.g., due to whitespace differences).
 *
 * The key constraint: highlights are consumed in order, preventing
 * cross-question matching.
 */
function matchHighlightsToLines(rawLines: string[], highlights: string[]): LineInfo[] {
  let highlightIdx = 0;
  // Maximum highlights to look ahead when matching
  const LOOKAHEAD = 3;

  return rawLines.map(text => {
    if (highlightIdx >= highlights.length) {
      return { text, highlighted: false };
    }

    // Strip prefixes for matching
    const stripped = text
      .replace(QUESTION_NUMBER_RE, '')
      .replace(OPTION_LETTER_RE, '')
      .replace(ROMAN_RE, '')
      .replace(BULLET_RE, '')
      .trim()
      .toLowerCase();

    if (!stripped || stripped.length < 3) {
      return { text, highlighted: false };
    }

    const normalizedStripped = stripped.replace(/\s+/g, ' ');

    // Check current and next few highlights (lookahead)
    for (let offset = 0; offset < LOOKAHEAD && (highlightIdx + offset) < highlights.length; offset++) {
      const candidate = highlights[highlightIdx + offset];
      const normalizedCandidate = candidate.replace(/\s+/g, ' ');

      // Match if line contains the highlight or highlight contains the line
      if (
        normalizedStripped.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedStripped)
      ) {
        // Consume ALL highlights up to and including this one
        highlightIdx = highlightIdx + offset + 1;
        return { text, highlighted: true };
      }
    }

    return { text, highlighted: false };
  });
}

// ─── Preprocessing ───────────────────────────────────────────────────────────

function preprocessText(text: string): string {
  let r = text;
  // Newline before numbered questions (e.g., "1. ¿" or "1. Los" or "1. Según")
  // Only when preceded by non-newline content
  r = r.replace(/([^\n])\s+(\d+[\.\)]\s*(?:¿|[A-Z]))/g, '$1\n$2');
  // Newline before roman numerals ONLY when they appear with substantial spacing
  // (distinguishes "I.  Afirmación" from "Solo I y II")
  r = r.replace(/([^\n])\s{2,}((?:I{1,3}|IV|VI{0,3}|IX|X{1,3})[\.\)]\s{2,})/g, '$1\n$2');
  // Newline before letter options (a. b. c. etc.) — even with minimal spacing
  // This handles cases where text is "...text. b) Option" or "...text  b. Option"
  r = r.replace(/([^\n])(\s+)([a-h][\.\)]\s)/gi, '$1\n$3');
  // Also handle case where option letter comes after a period: "text.a) " or "text. a) "
  r = r.replace(/([.?!])(\s*)([a-h][\.\)]\s)/gi, '$1\n$3');
  // Newline before bullets (•, ●, ·, -)
  r = r.replace(/([^\n])\s*([•●·])\s/g, '$1\n$2 ');
  // DO NOT split before ¿ in the middle of a sentence.
  // Newline before Verdadero/Falso standing alone
  r = r.replace(/([^\n])\s+(Verdadero|Falso)\s*$/gim, '$1\n$2');
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
      // Preserve bullet formatting in explanations
      if (BULLET_RE.test(text)) {
        explanationLines.push('• ' + text.replace(BULLET_RE, '').trim());
      } else {
        explanationLines.push(text);
      }
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
      explanationLines.push('• ' + text.replace(BULLET_RE, '').trim());
      continue;
    }

    // If we already have options and hit a non-option line → explanation
    if (options.length > 0) {
      doneOptions = true;
      explanationLines.push(text);
      continue;
    }

    // No options yet, no roman, no letter prefix → could be unprefixed option or assertion
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

  // Clean up explanation: remove trailing "N." that is actually the next question number
  while (explanationLines.length > 0) {
    const last = explanationLines[explanationLines.length - 1];
    if (/^\d+\.\s*$/.test(last)) {
      explanationLines.pop();
    } else {
      break;
    }
  }

  // Determine type
  const type = options.length > 0
    ? (correctIndices.length > 1 ? 'multiple_choice' : 'single_choice')
    : 'open_ended';

  return {
    question: {
      type,
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
    if (BULLET_RE.test(text)) { explanationLines.push('• ' + text.replace(BULLET_RE, '').trim()); i++; continue; }
    if (answer !== null) { explanationLines.push(text); i++; continue; }
    i++;
  }

  // Clean trailing question numbers
  while (explanationLines.length > 0 && /^\d+\.\s*$/.test(explanationLines[explanationLines.length - 1])) {
    explanationLines.pop();
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
    if (BULLET_RE.test(text)) { parsingExplanation = true; explanationLines.push('• ' + text.replace(BULLET_RE, '').trim()); i++; continue; }
    if (parsingExplanation) { explanationLines.push(text); i++; continue; }

    if (i + 1 < lines.length) {
      const next = lines[i + 1].text;
      if (next && !isQuestionStart(next) && !BULLET_RE.test(next) && !next.includes('\t')) {
        pairs.push({ left: text, right: next }); i += 2; continue;
      }
    }
    i++;
  }

  // Clean trailing question numbers
  while (explanationLines.length > 0 && /^\d+\.\s*$/.test(explanationLines[explanationLines.length - 1])) {
    explanationLines.pop();
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

  // A numbered line is a question if it contains "?" OR ends with ":" OR is reasonably long
  if (isNumbered && (stripped.includes('?') || stripped.endsWith(':') || stripped.length > 20)) return stripped;

  // A non-numbered line starting with ¿ and containing ? is a question
  if (QUESTION_START_RE.test(line) && line.includes('?')) return line;

  // Matching keyword
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
