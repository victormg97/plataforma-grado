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
  /** Position index from the HTML (for scoped highlight matching) */
  htmlPosition: number;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function parseQuestionsFromText(plainText: string, htmlText?: string): ParsedQuestion[] {
  // Build lines with per-line highlight info (positional, not global)
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
 * Build an array of {text, highlighted, htmlPosition} per line.
 * We parse the HTML to determine which lines contain highlighted spans.
 * 
 * IMPORTANT: Highlights are matched POSITIONALLY, not just by text content.
 * This prevents the bug where identical option text in different questions
 * gets incorrectly marked as correct.
 */
function buildLines(plainText: string, htmlText?: string): LineInfo[] {
  // Normalize text: ensure line breaks before key patterns
  const normalized = preprocessText(plainText);
  const rawLines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (!htmlText || typeof document === 'undefined') {
    return rawLines.map((text, idx) => ({ text, highlighted: false, htmlPosition: idx }));
  }

  // Extract highlighted segments with their position in the document
  const highlightedSegments = extractHighlightedSegmentsPositional(htmlText);

  return rawLines.map((text, idx) => {
    // Strip any prefix (number, roman, letter) for matching against highlighted set
    const stripped = text
      .replace(QUESTION_NUMBER_RE, '')
      .replace(OPTION_LETTER_RE, '')
      .replace(ROMAN_RE, '')
      .replace(BULLET_RE, '')
      .trim();

    // Check if THIS specific line is highlighted using positional matching
    const highlighted = isLineHighlightedPositional(stripped, idx, highlightedSegments, rawLines);

    return { text, highlighted, htmlPosition: idx };
  });
}

/**
 * A highlighted segment with its approximate position in the document.
 */
interface HighlightedSegment {
  text: string;        // Lowercased text
  charOffset: number;  // Approximate character offset in the full text
}

/**
 * Extract highlighted text segments from HTML along with their approximate
 * character position. This allows us to match highlights to the correct
 * question even when identical text appears in multiple questions.
 */
function extractHighlightedSegmentsPositional(html: string): HighlightedSegment[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  const segments: HighlightedSegment[] = [];

  const HIGHLIGHT_RE = /background(?:-color)?:\s*(?:yellow|#ffff00|#ff0|rgb\(\s*255,\s*255,\s*0\s*\))/i;
  const WORD_HIGHLIGHT_RE = /mso-highlight:\s*yellow/i;

  // Walk the DOM in order, tracking character position
  let charPos = 0;
  
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      charPos += (node.textContent || '').length;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    
    const el = node as HTMLElement;
    const style = el.getAttribute('style') || '';
    const isHighlighted = HIGHLIGHT_RE.test(style) || WORD_HIGHLIGHT_RE.test(style) || el.tagName === 'MARK';

    if (isHighlighted) {
      const t = (el.textContent || '').trim();
      if (t.length >= 3 && t.length <= 300) {
        segments.push({ text: t.toLowerCase(), charOffset: charPos });
      }
      // Still count the characters
      charPos += (el.textContent || '').length;
      return; // Don't descend into highlighted children (already captured)
    }

    for (const child of Array.from(el.childNodes)) {
      walk(child);
    }
  }

  walk(div);
  return segments;
}

/**
 * Determine if a specific line (by index) is highlighted.
 * Uses positional matching: finds the approximate character offset of the line
 * in the full text, then checks if a highlighted segment matches nearby.
 */
function isLineHighlightedPositional(
  strippedText: string,
  lineIdx: number,
  segments: HighlightedSegment[],
  allLines: string[]
): boolean {
  if (segments.length === 0) return false;
  if (!strippedText || strippedText.length < 3) return false;

  const lowerStripped = strippedText.toLowerCase();

  // Calculate approximate character offset for this line
  let charOffset = 0;
  for (let i = 0; i < lineIdx; i++) {
    charOffset += allLines[i].length + 1; // +1 for newline
  }

  // Find matching highlighted segments that are close to this position
  // Allow some tolerance since HTML and plain text positions may differ
  const tolerance = 500; // characters of tolerance
  
  for (const seg of segments) {
    // Check if the highlighted text matches this line's text
    const matches = lowerStripped.includes(seg.text) || seg.text.includes(lowerStripped);
    if (!matches) continue;

    // Check positional proximity
    const distance = Math.abs(seg.charOffset - charOffset);
    if (distance <= tolerance) {
      // Mark this segment as consumed so it can't match another line
      // (This prevents the cross-question highlight bug)
      seg.charOffset = -99999; // "consumed"
      return true;
    }
  }

  return false;
}

function preprocessText(text: string): string {
  let r = text;
  // Newline before numbered questions (e.g., "1. ¿" or "1. Los")
  // But only when it looks like a NEW question number (preceded by non-newline content)
  r = r.replace(/([^\n])\s+(\d+[\.\)]\s*(?:¿|[A-Z]))/g, '$1\n$2');
  // Newline before roman numerals (I. II. III. IV.) only when clearly an assertion
  // NOT when it's part of a sentence (e.g., "Solo I y II")
  r = r.replace(/([^\n])\s+((?:I{1,3}|IV|VI{0,3}|IX|X{1,3})[\.\)]\s{2,})/g, '$1\n$2');
  // Newline before letter options (a. b. c. etc.) — only with clear spacing
  r = r.replace(/([^\n])\s+([a-h][\.\)]\s)/gi, '$1\n$2');
  // Newline before bullets
  r = r.replace(/([^\n])\s*([•●])\s/g, '$1\n$2 ');
  // DO NOT add newline before ¿ in the middle of a sentence!
  // Only add newline before ¿ if it starts a new numbered question OR is at
  // the beginning after another complete sentence (ends with punctuation + space)
  r = r.replace(/([.!?])\s+(¿)/g, '$1\n$2');
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

  // A numbered line is a question if it contains "?" OR ends with ":" OR is long enough
  // The ENTIRE stripped text (including text before "¿") is the question content.
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
