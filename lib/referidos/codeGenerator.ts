// lib/referidos/codeGenerator.ts

/**
 * Curated list of words to avoid in the 4-char alphanumeric suffix.
 * Covers offensive/inappropriate words in Spanish and English.
 * Subset of common bad words that could appear in 3-4 char combinations.
 */
const BLOCKED_WORDS_3PLUS = new Set([
  // Spanish
  'CULO', 'PUTO', 'PUTA', 'MEAR', 'CACA', 'PENE', 'VULV', 'ANAL',
  'SEXO', 'TETA', 'CAGO', 'CAGA', 'FODE', 'ROTO', 'PEDO', 'CULO',
  'MIER', 'ODIO', 'MATA', 'MATO', 'DIOS', 'DIAB',
  // English  
  'FUCK', 'SHIT', 'CUNT', 'DICK', 'COCK', 'ANUS', 'PORN', 'BOOB',
  'BUTT', 'PISS', 'DAMN', 'HELL', 'SLUT', 'WHORE', 'RAPE', 'KILL',
  'DEAD', 'DRUG', 'HATE',
  // 3-char substrings to check within the 4-char code
  'ASS', 'FAG', 'GAY', 'JEW', 'KKK', 'SEX', 'CUM', 'TIT',
])

const ALPHANUMERIC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // removed I,O,1,0 to avoid confusion

function randomChar(): string {
  return ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)]
}

/** Returns true if this 4-char suffix contains any blocked word/substring */
function containsBlockedWord(suffix: string): boolean {
  for (const word of BLOCKED_WORDS_3PLUS) {
    if (suffix.includes(word)) return true
  }
  return false
}

/** Returns true if suffix has at least one digit (reduces word formation) */
function _hasAtLeastOneDigit(suffix: string): boolean {
  return /[0-9]/.test(suffix)
}

/** Returns true if suffix is all letters (4 letters = more likely to form words) */
function isAllLetters(suffix: string): boolean {
  return /^[A-Z]{4}$/.test(suffix)
}

/**
 * Generates the 2-char prefix from user name parts.
 * Pattern: {first letter of nombre}{first letter of apellido}
 * Fallback for missing apellido: apellido_materno[0] or 'X'
 */
export function buildCodePrefix(
  nombre: string,
  apellido: string | null | undefined,
  apellidoMaterno?: string | null,
): string {
  const first = (nombre || 'X').trim().toUpperCase()[0] ?? 'X'
  const second =
    (apellido || '').trim().toUpperCase()[0] ||
    (apellidoMaterno || '').trim().toUpperCase()[0] ||
    'X'
  return `${first}${second}`
}

/**
 * Generates a unique 4-char alphanumeric suffix.
 * Filters out blocked words and prefers at least one digit.
 * @throws Error if max attempts exceeded
 */
function generateSuffix(existingCodes: Set<string>, prefix: string, maxAttempts = 100): string {
  let attempts = 0
  while (attempts < maxAttempts) {
    const suffix = Array.from({ length: 4 }, randomChar).join('')
    // Prefer suffixes with at least one digit on first 80 attempts
    if (attempts < 80 && isAllLetters(suffix)) {
      attempts++
      continue
    }
    if (containsBlockedWord(suffix)) {
      attempts++
      continue
    }
    const fullCode = `${prefix}-${suffix}`
    if (existingCodes.has(fullCode)) {
      attempts++
      continue
    }
    return suffix
  }
  throw new Error(
    `Could not generate unique referral code after ${maxAttempts} attempts. Prefix: ${prefix}`,
  )
}

/**
 * Generates a user referral code in the format `XX-YYYY`.
 * @param nombre - User's first name
 * @param apellido - User's last name (primary)
 * @param existingCodes - Set of all currently used codes for this tenant (for uniqueness check)
 * @param apellidoMaterno - Optional fallback if apellido is empty
 * @returns The full code, e.g. "VM-9JK2"
 */
export function generateUserReferralCode(
  nombre: string,
  apellido: string | null | undefined,
  existingCodes: Set<string>,
  apellidoMaterno?: string | null,
): string {
  const prefix = buildCodePrefix(nombre, apellido, apellidoMaterno)
  const suffix = generateSuffix(existingCodes, prefix)
  return `${prefix}-${suffix}`
}

/**
 * Validates that a string matches the user referral code pattern.
 * Pattern: 2 uppercase letters, dash, 4 alphanumeric uppercase chars.
 * Example: "VM-9JK2"
 */
export function isValidUserReferralCodeFormat(code: string): boolean {
  return /^[A-Z]{2}-[A-Z0-9]{4}$/.test(code)
}

/**
 * Validates that a string matches the discount code pattern.
 * Pattern: exactly 6 uppercase alphanumeric chars.
 * Example: "PROMO1"
 */
export function isValidDiscountCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code)
}

const DISCOUNT_ALPHANUMERIC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generates a unique 6-char discount code (admin-created, not tied to a user).
 * Applies the same anti-word filter logic.
 * @param existingCodes - Set of all current discount codes for this tenant
 */
export function generateDiscountCode(existingCodes: Set<string>, maxAttempts = 100): string {
  let attempts = 0
  while (attempts < maxAttempts) {
    const code = Array.from({ length: 6 }, () =>
      DISCOUNT_ALPHANUMERIC[Math.floor(Math.random() * DISCOUNT_ALPHANUMERIC.length)]
    ).join('')
    // Check for blocked words as substrings
    let blocked = false
    for (const word of BLOCKED_WORDS_3PLUS) {
      if (code.includes(word)) {
        blocked = true
        break
      }
    }
    if (blocked) { attempts++; continue }
    if (existingCodes.has(code)) { attempts++; continue }
    return code
  }
  throw new Error(`Could not generate unique discount code after ${maxAttempts} attempts.`)
}
