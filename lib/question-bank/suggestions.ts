/**
 * Tag/Category auto-suggestion engine.
 * 
 * v1: Dictionary-based keyword matching (no AI, zero cost).
 * Architecture: isolated module with a single entry point (suggestTagsForText)
 * so it can be swapped for an AI-based engine in the future without touching
 * the form or data model.
 */

export interface SuggestionSource {
  id: string;
  name: string;
  keywords: string[];
}

export interface Suggestion {
  id: string;
  name: string;
  score: number; // Higher = more relevant (number of keyword matches)
}

/**
 * Normalizes text for matching: lowercases, removes accents/diacritics,
 * strips HTML tags, and splits into words.
 */
function normalizeText(text: string): string[] {
  // Strip HTML tags
  const stripped = text.replace(/<[^>]*>/g, ' ');
  // Normalize unicode (remove accents)
  const normalized = stripped.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Lowercase and split by non-word characters
  return normalized
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 2); // Ignore very short words
}

/**
 * Suggests tags or categories based on keyword dictionary matching.
 * 
 * @param text - The question content (can be HTML from rich text editor)
 * @param sources - Available tags/categories with their keyword dictionaries
 * @param maxResults - Maximum number of suggestions to return (default: 5)
 * @returns Sorted array of suggestions with match scores
 */
export function suggestTagsForText(
  text: string,
  sources: SuggestionSource[],
  maxResults: number = 5
): Suggestion[] {
  if (!text.trim() || sources.length === 0) return [];

  const words = normalizeText(text);
  if (words.length === 0) return [];

  // Create a Set for O(1) lookup
  const wordSet = new Set(words);

  const scored: Suggestion[] = [];

  for (const source of sources) {
    let score = 0;

    // Check each keyword against the text words
    for (const keyword of source.keywords) {
      const normalizedKeyword = keyword
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      // Support multi-word keywords (e.g., "derecho civil")
      const keywordParts = normalizedKeyword.split(/\W+/).filter(w => w.length > 2);

      if (keywordParts.length > 1) {
        // Multi-word keyword: check if ALL parts appear in the text
        const allPresent = keywordParts.every(part => wordSet.has(part));
        if (allPresent) score += 2; // Bonus for multi-word match
      } else if (keywordParts.length === 1) {
        // Single-word keyword: exact match in word set
        if (wordSet.has(keywordParts[0])) score += 1;
      }
    }

    // Also check if the source name itself appears in the text
    const nameNormalized = source.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const nameParts = nameNormalized.split(/\W+/).filter(w => w.length > 2);
    if (nameParts.length > 0 && nameParts.every(part => wordSet.has(part))) {
      score += 3; // Strong signal if the name itself is mentioned
    }

    if (score > 0) {
      scored.push({ id: source.id, name: source.name, score });
    }
  }

  // Sort by score descending, then by name alphabetically
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return scored.slice(0, maxResults);
}
