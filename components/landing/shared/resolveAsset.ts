import 'server-only';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Resuelve, en el servidor, la primera variante de un asset que exista en
 * /public, probando varias extensiones. Devuelve la ruta pública (servible por
 * el navegador) o null si ninguna existe.
 *
 * Evita disparar requests 400 al optimizador de imágenes de Next: solo se pide
 * el archivo que realmente existe.
 *
 * @param basePublicPath Ruta pública sin extensión (ej. "/tenants/x/landing/hero")
 * @param exts Extensiones a probar, en orden de preferencia
 */
export function resolveAsset(
  basePublicPath: string,
  exts: readonly string[] = ['jpg', 'jpeg', 'png', 'webp', 'avif'],
): string | null {
  const publicDir = join(process.cwd(), 'public');
  for (const ext of exts) {
    const publicPath = `${basePublicPath}.${ext}`;
    const absolute = join(publicDir, publicPath);
    if (existsSync(absolute)) {
      return publicPath;
    }
  }
  return null;
}
