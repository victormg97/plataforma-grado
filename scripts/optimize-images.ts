/**
 * Optimizador de imágenes para /public.
 *
 * Convierte imágenes (jpg/jpeg/png) a WebP optimizado, opcionalmente las
 * redimensiona a un ancho máximo, reporta el ahorro y (con --delete) borra los
 * archivos originales una vez convertidos. WebP preserva transparencia, así que
 * es seguro para logos PNG con alpha.
 *
 * Uso:
 *   npm run optimize-images -- <ruta> [<ruta> ...] [opciones]
 *
 * <ruta> puede ser un archivo o una carpeta (se procesa de forma recursiva),
 * relativa a la raíz del proyecto o absoluta.
 *
 * Opciones:
 *   --delete            Borra los archivos originales tras convertirlos.
 *   --max-width=<n>     Redimensiona a lo ancho si excede <n> px (no agranda).
 *   --quality=<n>       Calidad WebP 1–100 (default 80).
 *   --dry-run           Muestra qué haría sin escribir ni borrar nada.
 *
 * Ejemplos:
 *   npm run optimize-images -- public/tenants/pregunta-estrategica/landing/hero.jpeg --delete
 *   npm run optimize-images -- public/tenants/cta-graduados --delete --max-width=1600
 */

import sharp from 'sharp';
import { readdir, stat, unlink } from 'fs/promises';
import { join, extname, resolve, relative } from 'path';

const INPUT_EXTS = new Set(['.jpg', '.jpeg', '.png']);

interface Options {
  delete: boolean;
  maxWidth: number | null;
  quality: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): { paths: string[]; options: Options } {
  const paths: string[] = [];
  const options: Options = { delete: false, maxWidth: null, quality: 80, dryRun: false };

  for (const arg of argv) {
    if (arg === '--delete') options.delete = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--max-width=')) options.maxWidth = Number(arg.split('=')[1]);
    else if (arg.startsWith('--quality=')) options.quality = Number(arg.split('=')[1]);
    else if (arg.startsWith('--')) {
      throw new Error(`Opción desconocida: ${arg}`);
    } else {
      paths.push(arg);
    }
  }

  if (!paths.length) {
    throw new Error('Debes indicar al menos una ruta (archivo o carpeta).');
  }
  if (!Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100) {
    throw new Error('--quality debe ser un número entre 1 y 100.');
  }
  if (options.maxWidth !== null && (!Number.isFinite(options.maxWidth) || options.maxWidth < 1)) {
    throw new Error('--max-width debe ser un número positivo.');
  }
  return { paths, options };
}

/** Lista recursivamente los archivos de imagen soportados bajo una ruta. */
async function collectImages(target: string): Promise<string[]> {
  const info = await stat(target);
  if (info.isFile()) {
    return INPUT_EXTS.has(extname(target).toLowerCase()) ? [target] : [];
  }
  const out: string[] = [];
  for (const entry of await readdir(target)) {
    out.push(...(await collectImages(join(target, entry))));
  }
  return out;
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

async function main() {
  const { paths, options } = parseArgs(process.argv.slice(2));
  const root = process.cwd();

  // Reúne todas las imágenes de todas las rutas (dedupe).
  const files = new Set<string>();
  for (const p of paths) {
    const abs = resolve(root, p);
    for (const f of await collectImages(abs)) files.add(f);
  }

  if (!files.size) {
    console.log('No se encontraron imágenes (.jpg/.jpeg/.png) en las rutas indicadas.');
    return;
  }

  console.log(
    `${options.dryRun ? '[DRY-RUN] ' : ''}Optimizando ${files.size} imagen(es) ` +
      `→ WebP q${options.quality}${options.maxWidth ? `, max ${options.maxWidth}px` : ''}` +
      `${options.delete ? ', borrando originales' : ''}\n`,
  );

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const rel = relative(root, file);
    const outFile = file.replace(/\.(jpe?g|png)$/i, '.webp');
    const relOut = relative(root, outFile);

    const beforeBytes = (await stat(file)).size;
    totalBefore += beforeBytes;

    const image = sharp(file);
    const meta = await image.metadata();
    if (options.maxWidth && meta.width && meta.width > options.maxWidth) {
      image.resize({ width: options.maxWidth, withoutEnlargement: true });
    }

    if (options.dryRun) {
      console.log(`  ${rel}  →  ${relOut}  (antes ${kb(beforeBytes)})`);
      continue;
    }

    const buffer = await image.webp({ quality: options.quality }).toBuffer();
    await sharp(buffer).toFile(outFile);
    const afterBytes = buffer.length;
    totalAfter += afterBytes;

    const saved = beforeBytes - afterBytes;
    const pct = beforeBytes ? Math.round((saved / beforeBytes) * 100) : 0;
    console.log(
      `  ${rel}  →  ${relOut}   ${kb(beforeBytes)} → ${kb(afterBytes)} ` +
        `(${pct >= 0 ? '-' : '+'}${Math.abs(pct)}%)`,
    );

    // Borra el original solo si el nombre difiere (jpg/png → webp siempre difiere).
    if (options.delete && resolve(outFile) !== resolve(file)) {
      await unlink(file);
    }
  }

  if (!options.dryRun) {
    const saved = totalBefore - totalAfter;
    const pct = totalBefore ? Math.round((saved / totalBefore) * 100) : 0;
    console.log(`\nTotal: ${kb(totalBefore)} → ${kb(totalAfter)} (ahorro ${pct}%)`);
    if (options.delete) console.log('Originales borrados.');
  }
}

main().catch((err) => {
  console.error('\nError:', err instanceof Error ? err.message : err);
  process.exit(1);
});
