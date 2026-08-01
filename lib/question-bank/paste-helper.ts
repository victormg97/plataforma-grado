/**
 * Smart Paste Helper for Question Bank
 * 
 * Parses clipboard content (plain text and HTML) to extract:
 * - Multiple choice options (a), b), c)... or A., B., C... or numbered)
 * - Highlighted/marked correct answers (from HTML background-color)
 * - Matching pairs (two-column table format)
 */

export interface ParsedChoiceOption {
  text: string;
  is_correct: boolean;
}

export interface ParsedMatchingPair {
  left: string;
  right: string;
}

export interface PasteResult {
  type: 'choices' | 'matching' | 'unknown';
  options?: ParsedChoiceOption[];
  pairs?: ParsedMatchingPair[];
  raw: string;
}

// Pattern: a) text, b) text OR A) text OR a. text OR 1. text OR 1) text
const OPTION_PREFIX_REGEX = /^(?:[a-zA-Z][\).\-]|[ivxIVX]+[\).\-]|\d+[\).\-])\s*/;

// Detect highlighted text in HTML (yellow/mark background)
const HIGHLIGHT_PATTERNS = [
  /background-color:\s*(?:yellow|#ff(?:ff00|f[0-9a-f]{2})|rgb\(255,\s*255,\s*0\))/i,
  /background-color:\s*(?:#[0-9a-f]{6})/i, // Any background color that's not white/transparent
  /<mark[^>]*>/i,
];

/**
 * Parse clipboard content for choice-based questions.
 * Detects lettered/numbered options and highlighted correct answers.
 */
export function parseChoicesFromClipboard(plainText: string, htmlText?: string): ParsedChoiceOption[] {
  const lines = plainText
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) return [];

  // Check if lines follow a pattern (a), b), c)... or numbered)
  const hasPrefix = lines.some(l => OPTION_PREFIX_REGEX.test(l));

  let options: ParsedChoiceOption[];

  if (hasPrefix) {
    // Only take lines that match the prefix pattern
    options = lines
      .filter(l => OPTION_PREFIX_REGEX.test(l))
      .map(l => ({
        text: l.replace(OPTION_PREFIX_REGEX, '').trim(),
        is_correct: false,
      }));
  } else {
    // Treat each line as an option
    options = lines.map(l => ({
      text: l.trim(),
      is_correct: false,
    }));
  }

  // Try to detect correct answers from HTML highlighting
  if (htmlText && options.length > 0) {
    const correctIndices = detectHighlightedOptions(htmlText, options);
    correctIndices.forEach(idx => {
      if (idx < options.length) {
        options[idx].is_correct = true;
      }
    });
  }

  return options;
}

/**
 * Detect which options are highlighted in the HTML clipboard content.
 * Returns array of indices that are highlighted.
 */
function detectHighlightedOptions(html: string, options: ParsedChoiceOption[]): number[] {
  const highlighted: number[] = [];

  // Parse HTML to find highlighted text segments
  const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (!tempDiv) return highlighted;

  tempDiv.innerHTML = html;

  // Find all elements with background-color highlighting
  const allElements = tempDiv.querySelectorAll('*');
  const highlightedTexts: string[] = [];

  allElements.forEach(el => {
    const style = el.getAttribute('style') || '';
    const isHighlighted = HIGHLIGHT_PATTERNS.some(p => p.test(style)) ||
      el.tagName === 'MARK';

    if (isHighlighted) {
      const text = (el.textContent || '').trim();
      if (text) highlightedTexts.push(text);
    }
  });

  // Match highlighted texts to options
  if (highlightedTexts.length > 0) {
    options.forEach((opt, idx) => {
      const optClean = opt.text.toLowerCase();
      const isMatch = highlightedTexts.some(ht => {
        const htClean = ht.toLowerCase();
        // Check if the highlighted text contains the option or vice versa
        return optClean.includes(htClean) || htClean.includes(optClean);
      });
      if (isMatch) highlighted.push(idx);
    });
  }

  return highlighted;
}

/**
 * Parse clipboard content for matching/pairing questions.
 * Detects two-column format (tab-separated or alternating lines).
 */
export function parseMatchingFromClipboard(plainText: string): ParsedMatchingPair[] {
  const lines = plainText
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) return [];

  // Strategy 1: Tab-separated (from table copy in some apps)
  const tabSeparated = lines.filter(l => l.includes('\t'));
  if (tabSeparated.length >= 2) {
    return tabSeparated.map(l => {
      const parts = l.split('\t').map(p => p.trim()).filter(Boolean);
      return { left: parts[0] || '', right: parts[1] || '' };
    }).filter(p => p.left && p.right);
  }

  // Strategy 2: Alternating lines (concept, definition, concept, definition...)
  // This is how Word tables copy as plain text (column by column, row by row)
  if (lines.length >= 4 && lines.length % 2 === 0) {
    const pairs: ParsedMatchingPair[] = [];
    for (let i = 0; i < lines.length; i += 2) {
      pairs.push({ left: lines[i], right: lines[i + 1] });
    }
    return pairs;
  }

  // Strategy 3: Odd number of lines — try alternating anyway with last line as orphan
  if (lines.length >= 3) {
    const pairs: ParsedMatchingPair[] = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      pairs.push({ left: lines[i], right: lines[i + 1] });
    }
    if (pairs.length >= 2) return pairs;
  }

  return [];
}

/**
 * Main entry point: analyze clipboard content and return parsed result.
 * Detects whether it's choices or matching based on the question type hint.
 */
export function parseClipboard(
  plainText: string,
  htmlText: string | undefined,
  typeHint: 'choices' | 'matching'
): PasteResult {
  if (!plainText.trim()) {
    return { type: 'unknown', raw: '' };
  }

  if (typeHint === 'matching') {
    const pairs = parseMatchingFromClipboard(plainText);
    if (pairs.length >= 2) {
      return { type: 'matching', pairs, raw: plainText };
    }
  }

  if (typeHint === 'choices') {
    const options = parseChoicesFromClipboard(plainText, htmlText);
    if (options.length >= 2) {
      return { type: 'choices', options, raw: plainText };
    }
  }

  // Fallback: try both
  const pairs = parseMatchingFromClipboard(plainText);
  if (pairs.length >= 2) {
    return { type: 'matching', pairs, raw: plainText };
  }

  const options = parseChoicesFromClipboard(plainText, htmlText);
  if (options.length >= 2) {
    return { type: 'choices', options, raw: plainText };
  }

  return { type: 'unknown', raw: plainText };
}
