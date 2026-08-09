/**
 * Smart text parser for question bank — Google Docs document format.
 *
 * Strategy:
 * 1. Extract ALL highlighted texts from HTML as an ordered list.
 * 2. Parse plain text into questions with options.
 * 3. For each question's options, check if any option text appears in the
 *    highlight list (scoped to nearby highlights only to prevent cross-question).
 *
 * This decouples structure parsing from highlight detection.
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
const OPTION_LETTER_ONLY_RE = /^[a-h][\.\)\-]\s*$/i;
const ROMAN_RE = /^(?:I{1,3}|IV|VI{0,3}|IX|X{1,3})[\.\)\-]\s+/;
const BULLET_RE = /^[•●·]\s*/;
const TRUE_FALSE_RE = /verdadero\s*o\s*falso/i;
const MATCHING_RE = /emparej/i;
const QUESTION_START_RE = /^¿/;
const TITLE_RE = /^(?:cuestionario|sección|parte|capítulo|tema)\b/i;
const EXPLANATION_MIN_LEN = 70;

// ─── Main ────────────────────────────────────────────────────────────────────

export function parseQuestionsFromText(plainText: string, htmlText?: string): ParsedQuestion[] {
  // Step 1: Extract highlights from HTML in order
  const highlights = htmlText ? extractHighlightsOrdered(htmlText) : [];

  // Step 2: Parse structure from plain text
  const normalized = preprocessText(plainText);
  const rawLines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Merge orphan letter-only lines with the next line
  // (handles case where "a)" is on one line and the option text on the next)
  const lines = mergeOrphanLetterLines(rawLines);

  const questions: ParsedQuestion[] = [];
  let i = 0;

  while (i < lines.length) {
    const text = lines[i];
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

  // Step 3: Match highlights to options (scoped per question)
  assignHighlightsToQuestions(questions, highlights);

  return questions;
}

// ─── Merge orphan letter lines ───────────────────────────────────────────────

/**
 * If a line is ONLY a letter prefix (e.g., "b)" or "c.") with no content,
 * merge it with the next line. This handles Word paste where the letter
 * and the option text end up on separate lines.
 */
function mergeOrphanLetterLines(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (OPTION_LETTER_ONLY_RE.test(lines[i]) && i + 1 < lines.length) {
      // Merge: "b)" + "Un contrato que..." → "b) Un contrato que..."
      result.push(lines[i].trim() + ' ' + lines[i + 1].trim());
      i += 2;
    } else {
      result.push(lines[i]);
      i++;
    }
  }
  return result;
}

// ─── Highlight extraction ────────────────────────────────────────────────────

/**
 * Extract highlighted text snippets from HTML in DOM order.
 */
function extractHighlightsOrdered(html: string): string[] {
  if (typeof document === 'undefined') return [];

  const div = document.createElement('div');
  div.innerHTML = html;
  const texts: string[] = [];

  const HIGHLIGHT_RE = /background(?:-color)?:\s*(?:yellow|#ffff00|#ff0|rgb\(\s*255,\s*255,\s*0\s*\))/i;
  const WORD_HIGHLIGHT_RE = /mso-highlight:\s*yellow/i;

  function walk(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const style = el.getAttribute('style') || '';
    const isHighlighted = HIGHLIGHT_RE.test(style) || WORD_HIGHLIGHT_RE.test(style) || el.tagName === 'MARK';

    if (isHighlighted) {
      const t = (el.textContent || '').trim();
      if (t.length >= 3) {
        texts.push(t);
      }
      return; // Don't descend
    }

    for (const child of Array.from(el.childNodes)) {
      walk(child);
    }
  }

  walk(div);
  return texts;
}

// ─── Highlight assignment (post-parse) ───────────────────────────────────────

/**
 * Assign highlights to question options AFTER parsing structure.
 * 
 * Strategy: For each highlight (in order), find the best matching question+option.
 * 
 * Key rules:
 * - Each highlight is consumed exactly once.
 * - questionSearchStart only moves forward, preventing backward cross-question matches.
 * - When a highlight could match the current question (which already has a correct answer)
 *   OR the next question, prefer the next question (prevents false multiple-choice).
 * - Each option can only be marked correct once.
 */
function assignHighlightsToQuestions(questions: ParsedQuestion[], highlights: string[]): void {
  if (highlights.length === 0) return;

  let questionSearchStart = 0;

  for (const highlight of highlights) {
    const hlNorm = normalizeForMatch(highlight);
    if (hlNorm.length < 3) continue;

    // Find the best match starting from questionSearchStart
    const match = findBestMatch(questions, questionSearchStart, hlNorm);

    if (match) {
      const q = questions[match.qi];
      if (!q.correctIndices.includes(match.oi)) {
        q.correctIndices.push(match.oi);
      }
      questionSearchStart = match.qi;
    }
  }

  // After assignment, fix types
  for (const q of questions) {
    if (q.options.length > 0) {
      q.type = q.correctIndices.length > 1 ? 'multiple_choice' : 'single_choice';
    }
  }
}

/**
 * Find the best question+option match for a highlight.
 * 
 * Priority:
 * 1. First question (from searchStart) that has NO correct answer yet and has a match (score >= 0.8)
 * 2. If the only match is a question that already has a correct answer, only accept
 *    if NO subsequent question without a correct answer has a match.
 */
function findBestMatch(
  questions: ParsedQuestion[],
  searchStart: number,
  hlNorm: string
): { qi: number; oi: number } | null {
  let firstMatchWithAnswer: { qi: number; oi: number; score: number } | null = null;
  let firstMatchWithoutAnswer: { qi: number; oi: number; score: number } | null = null;

  for (let qi = searchStart; qi < questions.length; qi++) {
    const q = questions[qi];
    if (q.options.length === 0) continue;

    let bestOi = -1;
    let bestScore = 0;

    for (let oi = 0; oi < q.options.length; oi++) {
      if (q.correctIndices.includes(oi)) continue;
      const optNorm = normalizeForMatch(q.options[oi]);
      const score = matchScore(optNorm, hlNorm);
      if (score > bestScore) {
        bestScore = score;
        bestOi = oi;
      }
    }

    if (bestOi >= 0 && bestScore >= 0.8) {
      const hasCorrectAlready = q.correctIndices.length > 0;

      if (!hasCorrectAlready && !firstMatchWithoutAnswer) {
        firstMatchWithoutAnswer = { qi, oi: bestOi, score: bestScore };
        // Found a clean match — use it immediately
        break;
      } else if (hasCorrectAlready && !firstMatchWithAnswer) {
        firstMatchWithAnswer = { qi, oi: bestOi, score: bestScore };
        // Don't break — keep looking for a question without an answer
      }
    }
  }

  // Prefer question without a correct answer (prevents false multiple_choice)
  if (firstMatchWithoutAnswer) {
    return { qi: firstMatchWithoutAnswer.qi, oi: firstMatchWithoutAnswer.oi };
  }

  // Fall back to question that already has an answer (genuine multiple_choice)
  if (firstMatchWithAnswer) {
    return { qi: firstMatchWithAnswer.qi, oi: firstMatchWithAnswer.oi };
  }

  return null;
}

/**
 * Normalize text for matching: lowercase, collapse whitespace, strip punctuation edges.
 */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[a-h][\.\)\-]\s*/i, '') // strip option letter prefix if present
    .replace(/^\d+[\.\)\-]\s*/, '')    // strip number prefix if present
    .replace(/\.$/, '')                 // strip trailing period
    .trim();
}

/**
 * Calculate match score between an option and a highlight.
 * Returns a value between 0 and 1 indicating how well they match.
 * 
 * - Exact match = 1.0
 * - One contains the other substantially = 0.8-0.99
 * - Partial overlap = lower
 */
function matchScore(optNorm: string, hlNorm: string): number {
  if (optNorm === hlNorm) return 1.0;

  // One contains the other
  if (optNorm.includes(hlNorm)) {
    // The highlight is a substring of the option
    // Score based on how much of the option the highlight covers
    return hlNorm.length / optNorm.length;
  }
  if (hlNorm.includes(optNorm)) {
    // The option is a substring of the highlight
    // Score based on how much of the highlight the option covers
    return optNorm.length / hlNorm.length;
  }

  // No containment — check if they share a long common prefix/suffix
  // (handles minor differences at the edges)
  const shorter = optNorm.length <= hlNorm.length ? optNorm : hlNorm;
  const longer = optNorm.length > hlNorm.length ? optNorm : hlNorm;

  // Check prefix match
  let prefixLen = 0;
  for (let i = 0; i < shorter.length && i < longer.length; i++) {
    if (shorter[i] === longer[i]) prefixLen++;
    else break;
  }

  if (prefixLen >= shorter.length * 0.85) {
    return prefixLen / longer.length;
  }

  return 0;
}

// ─── Preprocessing ───────────────────────────────────────────────────────────

function preprocessText(text: string): string {
  let r = text;
  // Newline before numbered questions (e.g., "1. ¿" or "1. Los" or "1. Según")
  r = r.replace(/([^\n])\s+(\d+[\.\)]\s*(?:¿|[A-Z]))/g, '$1\n$2');
  // Newline before roman numerals with substantial spacing
  r = r.replace(/([^\n])\s{2,}((?:I{1,3}|IV|VI{0,3}|IX|X{1,3})[\.\)]\s{2,})/g, '$1\n$2');
  // Newline before letter options
  r = r.replace(/([^\n])(\s+)([a-h][\.\)]\s)/gi, '$1\n$3');
  // Option letter after sentence-ending punctuation
  r = r.replace(/([.?!])(\s*)([a-h][\.\)]\s)/gi, '$1\n$3');
  // Newline before bullets
  r = r.replace(/([^\n])\s*([•●·])\s/g, '$1\n$2 ');
  // Newline before standalone Verdadero/Falso
  r = r.replace(/([^\n])\s+(Verdadero|Falso)\s*$/gim, '$1\n$2');
  return r;
}

// ─── Choice parser ───────────────────────────────────────────────────────────

function parseChoice(
  lines: string[], startIdx: number, content: string
): { question: ParsedQuestion; nextIndex: number } {
  let i = startIdx;
  const options: string[] = [];
  const explanationLines: string[] = [];
  const romanLines: string[] = [];

  // Collect body lines until next question
  const body: string[] = [];
  while (i < lines.length) {
    if (isQuestionStart(lines[i])) break;
    body.push(lines[i]);
    i++;
  }

  // Classify each body line
  let doneOptions = false;
  for (const text of body) {
    if (doneOptions) {
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

    // No options yet, no roman, no letter prefix
    if (text.length > EXPLANATION_MIN_LEN && looksLikeExplanation(text)) {
      doneOptions = true;
      explanationLines.push(text);
    } else {
      options.push(text);
    }
  }

  // Append roman lines to question content
  if (romanLines.length > 0) {
    content = content + '\n' + romanLines.join('\n');
  }

  // Clean trailing question numbers from explanation
  while (explanationLines.length > 0) {
    const last = explanationLines[explanationLines.length - 1];
    if (/^\d+\.\s*$/.test(last)) {
      explanationLines.pop();
    } else {
      break;
    }
  }

  const type = options.length > 0 ? 'single_choice' : 'open_ended';

  return {
    question: {
      type,
      content,
      options,
      correctIndices: [], // Will be filled by assignHighlightsToQuestions
      matchingPairs: [],
      trueFalseAnswer: null,
      explanation: explanationLines.join('\n'),
    },
    nextIndex: i,
  };
}

// ─── True/False parser ───────────────────────────────────────────────────────

function parseTrueFalse(lines: string[], startIdx: number, content: string): { question: ParsedQuestion; nextIndex: number } {
  let i = startIdx;
  let answer: boolean | null = null;
  const explanationLines: string[] = [];

  let statement = content;
  const tfMatch = content.match(/^¿?verdadero\s*o\s*falso\??\s*/i);
  if (tfMatch) statement = content.slice(tfMatch[0].length).trim();

  if (!statement && i < lines.length) {
    const next = lines[i];
    if (!isQuestionStart(next) && !/^(verdadero|falso)$/i.test(next)) {
      statement = next; i++;
    }
  }

  while (i < lines.length) {
    const text = lines[i];
    if (isQuestionStart(text)) break;
    if (/^verdadero$/i.test(text)) { answer = true; i++; continue; }
    if (/^falso$/i.test(text)) { answer = false; i++; continue; }
    if (BULLET_RE.test(text)) { explanationLines.push('• ' + text.replace(BULLET_RE, '').trim()); i++; continue; }
    if (answer !== null) { explanationLines.push(text); i++; continue; }
    i++;
  }

  while (explanationLines.length > 0 && /^\d+\.\s*$/.test(explanationLines[explanationLines.length - 1])) {
    explanationLines.pop();
  }

  return {
    question: { type: 'true_false', content: statement || content, options: [], correctIndices: [], matchingPairs: [], trueFalseAnswer: answer, explanation: explanationLines.join('\n') },
    nextIndex: i,
  };
}

// ─── Matching parser ─────────────────────────────────────────────────────────

function parseMatching(lines: string[], startIdx: number, content: string): { question: ParsedQuestion; nextIndex: number } {
  let i = startIdx;
  const pairs: Array<{ left: string; right: string }> = [];
  const explanationLines: string[] = [];
  let parsingExplanation = false;

  while (i < lines.length) {
    const text = lines[i];
    if (isQuestionStart(text)) break;

    if (text.includes('\t')) {
      const parts = text.split('\t').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) { pairs.push({ left: parts[0], right: parts[1] }); i++; continue; }
    }
    if (BULLET_RE.test(text)) { parsingExplanation = true; explanationLines.push('• ' + text.replace(BULLET_RE, '').trim()); i++; continue; }
    if (parsingExplanation) { explanationLines.push(text); i++; continue; }

    if (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (next && !isQuestionStart(next) && !BULLET_RE.test(next) && !next.includes('\t')) {
        pairs.push({ left: text, right: next }); i += 2; continue;
      }
    }
    i++;
  }

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

  if (isNumbered && (stripped.includes('?') || stripped.endsWith(':') || stripped.length > 20)) return stripped;
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
