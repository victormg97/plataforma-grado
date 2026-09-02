/**
 * Badge image validation constants and helpers (Slice 3, Req. 2).
 *
 * Accepted formats: PNG or SVG. PNG must be square (1:1). Max size and the
 * recommended dimension come from game_settings (badge_image_max_bytes,
 * badge_image_recommended_px) so they are adjustable per tenant without a
 * schema change. Transparent background is recommended for PNG.
 */

export const BADGE_IMAGE_ACCEPTED_MIME = ['image/png', 'image/svg+xml'] as const;
export const BADGE_IMAGE_ACCEPTED_EXT = ['.png', '.svg'] as const;

/** Fallbacks when a game_settings row is not available. */
export const BADGE_IMAGE_DEFAULT_MAX_BYTES = 2097152; // 2 MB
export const BADGE_IMAGE_DEFAULT_RECOMMENDED_PX = 512;

export interface BadgeImageValidationResult {
  ok: boolean;
  /** Error code when ok=false (INVALID_FORMAT | TOO_LARGE | NOT_SQUARE). */
  errorCode?: 'INVALID_FORMAT' | 'TOO_LARGE' | 'NOT_SQUARE';
  /** Non-blocking warning (e.g. dimension differs from recommended). */
  warning?: 'DIMENSION_NOT_RECOMMENDED';
  width?: number;
  height?: number;
}

/**
 * Reads the pixel dimensions of a PNG from its header (IHDR chunk). Returns
 * null if the buffer is not a valid PNG. No external dependency needed.
 */
export function readPngDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length < 24) return null;
  for (let i = 0; i < sig.length; i++) {
    if (buffer[i] !== sig[i]) return null;
  }
  // IHDR width/height are big-endian uint32 at byte offsets 16 and 20.
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

export function isSvg(mime: string, bytes: Uint8Array): boolean {
  if (mime === 'image/svg+xml') return true;
  // Sniff: SVG files start with "<?xml" or "<svg".
  const head = new TextDecoder().decode(bytes.slice(0, 256)).trimStart().toLowerCase();
  return head.startsWith('<?xml') || head.startsWith('<svg');
}

/**
 * Validates a badge image buffer. `maxBytes` and `recommendedPx` should come
 * from game_settings. PNG is validated for square proportion (Req. 2.2) and
 * a non-blocking dimension warning (Req. 2.5); SVG skips the pixel checks
 * (Req. 2.3).
 */
export function validateBadgeImage(
  mime: string,
  bytes: Uint8Array,
  maxBytes: number,
  recommendedPx: number
): BadgeImageValidationResult {
  const svg = isSvg(mime, bytes);
  const png = mime === 'image/png';

  if (!svg && !png) {
    return { ok: false, errorCode: 'INVALID_FORMAT' };
  }

  if (bytes.length > maxBytes) {
    return { ok: false, errorCode: 'TOO_LARGE' };
  }

  if (svg) {
    // Dimension checks are skipped for SVG (Req. 2.3).
    return { ok: true };
  }

  // PNG: verify square proportion (Req. 2.2).
  const dims = readPngDimensions(bytes);
  if (!dims) {
    return { ok: false, errorCode: 'INVALID_FORMAT' };
  }
  if (dims.width !== dims.height) {
    return { ok: false, errorCode: 'NOT_SQUARE', width: dims.width, height: dims.height };
  }

  // Non-blocking warning when dimension differs from recommended (Req. 2.5).
  if (dims.width !== recommendedPx) {
    return { ok: true, warning: 'DIMENSION_NOT_RECOMMENDED', width: dims.width, height: dims.height };
  }

  return { ok: true, width: dims.width, height: dims.height };
}
