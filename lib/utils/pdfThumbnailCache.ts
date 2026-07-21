/**
 * In-memory cache for rendered PDF thumbnail images.
 * Stores the canvas data URL so thumbnails don't need to be re-rendered
 * when the component re-mounts (e.g. navigating in/out of folders).
 *
 * The cache lives for the lifetime of the SPA session.
 */

const cache = new Map<string, string>();

export function getThumbnailFromCache(recursoId: string): string | null {
  return cache.get(recursoId) ?? null;
}

export function setThumbnailInCache(recursoId: string, dataUrl: string): void {
  cache.set(recursoId, dataUrl);
}

export function hasThumbnailInCache(recursoId: string): boolean {
  return cache.has(recursoId);
}
