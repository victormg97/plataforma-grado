#!/usr/bin/env node
/**
 * Verification script for the "seguimiento de cedularios por alumno" feature.
 *
 * Usage:
 *   node scripts/verificar-seguimiento.mjs [--i18n] [--encoding] [--static]
 *
 * Without options the three checks run. Exit code is 0 when every selected
 * check passes and 1 when any of them reports a failure (warnings never fail).
 * Paths that do not exist yet are skipped silently, so the script can run at
 * any point of the implementation plan.
 *
 * Checks:
 *   --i18n      Same key structure under `cedularios` in es/en, every literal
 *               t('key') used by the inspected components exists in both
 *               languages, and every CedularioErrorCode has a message.
 *   --encoding  Looks for mojibake sequences in the files written by the spec.
 *   --static    No hex colors in components, pure domain layer, and Server
 *               Actions that only export async functions.
 *
 * Node ESM, no dependencies. The source is kept ASCII on purpose: mojibake
 * patterns are written as \u escapes so this file never trips its own check.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* -------------------------------------------------------------------------- */
/* Generic helpers                                                            */
/* -------------------------------------------------------------------------- */

const SKIPPED_DIRS = new Set(['node_modules', '.next', '.git']);

function rel(absPath) {
  return relative(ROOT, absPath).split('\\').join('/');
}

/** Recursively lists files with one of the extensions. Missing paths give []. */
function walk(absPath, exts) {
  if (!existsSync(absPath)) return [];
  const stat = statSync(absPath);
  if (stat.isFile()) return exts.some((e) => absPath.endsWith(e)) ? [absPath] : [];
  if (!stat.isDirectory()) return [];
  const out = [];
  for (const entry of readdirSync(absPath, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIPPED_DIRS.has(entry.name)) continue;
    out.push(...walk(join(absPath, entry.name), exts));
  }
  return out;
}

/**
 * Resolves a relative target to files. A target can be a directory, a file, or
 * a module path without extension (for example components/common/HoverCard that
 * may be HoverCard.tsx or a HoverCard folder).
 */
function collect(target, exts) {
  const abs = resolve(ROOT, target);
  if (existsSync(abs)) return walk(abs, exts);
  const out = [];
  for (const ext of ['.tsx', '.ts']) {
    if (existsSync(abs + ext)) out.push(...walk(abs + ext, exts));
  }
  return out;
}

function collectAll(targets, exts) {
  const seen = new Set();
  for (const target of targets) {
    for (const file of collect(target, exts)) seen.add(file);
  }
  return [...seen].sort();
}

function readText(absPath) {
  return readFileSync(absPath, 'utf8');
}

function readJson(absPath) {
  try {
    return JSON.parse(readText(absPath).replace(/^\uFEFF/, ''));
  } catch (error) {
    return { __error: error instanceof Error ? error.message : String(error) };
  }
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

/**
 * Removes // and block comments but keeps string contents. Comment characters
 * are replaced by spaces (newlines are kept) so offsets and line numbers stay
 * identical to the original text.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === '/' && next === '/') {
      let j = i;
      while (j < n && src[j] !== '\n') j += 1;
      out += blank(src.slice(i, j));
      i = j;
    } else if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const j = end === -1 ? n : end + 2;
      out += blank(src.slice(i, j));
      i = j;
    } else if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && src[j] !== ch && src[j] !== '\n') {
        j += src[j] === '\\' ? 2 : 1;
      }
      j = Math.min(j + 1, n);
      out += src.slice(i, j);
      i = j;
    } else if (ch === '`') {
      let j = i + 1;
      while (j < n && src[j] !== '`') {
        j += src[j] === '\\' ? 2 : 1;
      }
      j = Math.min(j + 1, n);
      out += src.slice(i, j);
      i = j;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

/** Collects results of a check. */
function createReport(name) {
  return {
    name,
    failures: [],
    warnings: [],
    notes: [],
    fail(message) {
      this.failures.push(message);
    },
    warn(message) {
      this.warnings.push(message);
    },
    note(message) {
      this.notes.push(message);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* --i18n                                                                     */
/* -------------------------------------------------------------------------- */

const LOCALES = ['es', 'en'];

/** Same merge as i18n/request.ts: base file plus messages/pages/<locale>/*.json. */
function loadMessages(locale, report) {
  const basePath = join(ROOT, 'messages', `${locale}.json`);
  if (!existsSync(basePath)) {
    report.fail(`messages/${locale}.json no existe`);
    return {};
  }
  const base = readJson(basePath);
  if (base.__error) {
    report.fail(`messages/${locale}.json no es JSON valido: ${base.__error}`);
    return {};
  }
  const merged = { ...base };
  const pagesDir = join(ROOT, 'messages', 'pages', locale);
  if (existsSync(pagesDir)) {
    for (const file of readdirSync(pagesDir).filter((f) => f.endsWith('.json'))) {
      const data = readJson(join(pagesDir, file));
      if (data.__error) {
        report.fail(`messages/pages/${locale}/${file} no es JSON valido: ${data.__error}`);
        continue;
      }
      merged[file.replace(/\.json$/, '')] = data;
    }
  }
  return merged;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Flattens an object into a map "a.b.c" -> 'string' | 'object' | other type. */
function flatten(value, prefix, out) {
  if (isPlainObject(value)) {
    if (prefix !== '') out.set(prefix, 'object');
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix === '' ? key : `${prefix}.${key}`, out);
    }
  } else {
    out.set(prefix, typeof value);
  }
  return out;
}

function lookup(messages, path) {
  let current = messages;
  for (const part of path.split('.')) {
    if (!isPlainObject(current) || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

function checkStructure(messages, report) {
  const trees = {};
  for (const locale of LOCALES) {
    const subtree = messages[locale].cedularios;
    if (!isPlainObject(subtree)) {
      report.fail(`messages/${locale}.json no tiene el grupo "cedularios"`);
      return;
    }
    trees[locale] = flatten(subtree, '', new Map());
  }
  let differences = 0;
  const [a, b] = LOCALES;
  for (const [key, kind] of trees[a]) {
    if (!trees[b].has(key)) {
      report.fail(`cedularios.${key}: existe en ${a} y falta en ${b}`);
      differences += 1;
    } else if (trees[b].get(key) !== kind) {
      report.fail(`cedularios.${key}: tipo distinto (${a}: ${kind}, ${b}: ${trees[b].get(key)})`);
      differences += 1;
    }
  }
  for (const key of trees[b].keys()) {
    if (!trees[a].has(key)) {
      report.fail(`cedularios.${key}: existe en ${b} y falta en ${a}`);
      differences += 1;
    }
  }
  if (differences === 0) {
    report.note(`estructura de "cedularios" identica en es y en (${trees[a].size} nodos)`);
  }
}

const I18N_TARGETS = [
  'components/cedularios/seguimiento',
  'components/cedularios/cedularios/CedularioDetail.tsx',
  'components/cedularios/estructura/MateriaDelete.tsx',
  'components/cedularios/hooks/useCedulariosAction.ts',
  'components/alumnos',
  'app/(dashboard)/alumno',
];

const TRANSLATOR_DECL =
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(useTranslations|getTranslations)\s*\(([^)]*)\)/g;

/** Parses the argument of useTranslations/getTranslations. Returns string or null (unknown). */
function parseNamespaceArg(rawArg) {
  const arg = rawArg.trim();
  if (arg === '') return '';
  const literal = arg.match(/^(['"`])([^'"`$]*)\1$/);
  if (literal) return literal[2];
  const option = arg.match(/namespace\s*:\s*(['"`])([^'"`$]*)\1/);
  if (option) return option[2];
  return null;
}

/**
 * Reads the first argument of a call starting right after "(".
 * Returns { kind: 'literal', value } or { kind: 'dynamic', text }.
 */
function readFirstArg(src, start) {
  let i = start;
  while (i < src.length && /\s/.test(src[i])) i += 1;
  const quote = src[i];
  if (quote === "'" || quote === '"' || quote === '`') {
    let j = i + 1;
    let hasInterpolation = false;
    while (j < src.length && src[j] !== quote) {
      if (src[j] === '\\') {
        j += 2;
        continue;
      }
      if (quote === '`' && src[j] === '$' && src[j + 1] === '{') hasInterpolation = true;
      j += 1;
    }
    const value = src.slice(i + 1, j);
    let k = j + 1;
    while (k < src.length && /\s/.test(src[k])) k += 1;
    const closes = src[k] === ',' || src[k] === ')';
    if (!hasInterpolation && closes) return { kind: 'literal', value };
    return { kind: 'dynamic', text: src.slice(i, Math.min(j + 1, i + 60)) };
  }
  let j = i;
  while (j < src.length && src[j] !== ',' && src[j] !== ')' && src[j] !== '\n' && j - i < 60) j += 1;
  return { kind: 'dynamic', text: src.slice(i, j).trim() };
}

function checkSourceKeys(messages, report) {
  const files = collectAll(I18N_TARGETS, ['.ts', '.tsx']);
  let inspected = 0;
  let literalCount = 0;
  let dynamicCount = 0;

  for (const file of files) {
    const original = readText(file);
    if (!/useTranslations|getTranslations/.test(original)) continue;
    const src = stripComments(original);
    const decls = [];
    TRANSLATOR_DECL.lastIndex = 0;
    let m;
    while ((m = TRANSLATOR_DECL.exec(src)) !== null) {
      decls.push({ name: m[1], index: m.index, namespace: parseNamespaceArg(m[3]) });
    }
    if (decls.length === 0) continue;
    inspected += 1;

    const names = [...new Set(decls.map((d) => d.name))];
    for (const name of names) {
      const escaped = name.replace(/\$/g, '\\$');
      const callRe = new RegExp(
        `(?<![\\w$.])${escaped}(?:\\.(?:rich|raw|markup|has))?\\s*\\(`,
        'g',
      );
      let c;
      while ((c = callRe.exec(src)) !== null) {
        // Nearest declaration of this name above the call decides the namespace.
        let decl = null;
        for (const d of decls) {
          if (d.name === name && d.index < c.index) decl = d;
        }
        if (!decl) continue;
        const where = `${rel(file)}:${lineOf(src, c.index)}`;
        if (decl.namespace === null) {
          report.warn(`${where}: espacio de nombres no literal en useTranslations, se omite ${name}(...)`);
          continue;
        }
        const arg = readFirstArg(src, c.index + c[0].length);
        if (arg.kind === 'dynamic') {
          dynamicCount += 1;
          report.warn(`${where}: clave dinamica ${name}(${arg.text}) en el espacio "${decl.namespace}"`);
          continue;
        }
        literalCount += 1;
        const fullKey = decl.namespace === '' ? arg.value : `${decl.namespace}.${arg.value}`;
        for (const locale of LOCALES) {
          const found = lookup(messages[locale], fullKey);
          if (typeof found !== 'string') {
            const motivo = found === undefined ? 'falta' : 'no es un texto';
            report.fail(`${where}: clave "${fullKey}" ${motivo} en ${locale}`);
          }
        }
      }
    }
  }
  report.note(
    `${inspected} archivos con useTranslations, ${literalCount} claves literales, ${dynamicCount} dinamicas`,
  );
}

function checkErrorCodes(messages, report) {
  const errorsPath = join(ROOT, 'lib', 'cedularios', 'errors.ts');
  if (!existsSync(errorsPath)) {
    report.warn('lib/cedularios/errors.ts no existe, se omiten los codigos de error');
    return;
  }
  const src = stripComments(readText(errorsPath));
  const block = src.match(/CEDULARIO_ERROR_CODES\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
  if (!block) {
    report.fail('no se pudo leer CEDULARIO_ERROR_CODES en lib/cedularios/errors.ts');
    return;
  }
  const codes = [...block[1].matchAll(/['"]([A-Za-z0-9_]+)['"]/g)].map((x) => x[1]);
  let missing = 0;
  for (const code of codes) {
    for (const locale of LOCALES) {
      if (typeof lookup(messages[locale], `cedularios.errores.${code}`) !== 'string') {
        report.fail(`cedularios.errores.${code} falta en ${locale}`);
        missing += 1;
      }
    }
  }
  if (missing === 0) report.note(`${codes.length} codigos de error con mensaje en es y en`);
}

function runI18n() {
  const report = createReport('i18n');
  const messages = {};
  for (const locale of LOCALES) messages[locale] = loadMessages(locale, report);
  if (report.failures.length > 0) return report;
  checkStructure(messages, report);
  checkSourceKeys(messages, report);
  checkErrorCodes(messages, report);
  return report;
}

/* -------------------------------------------------------------------------- */
/* --encoding                                                                 */
/* -------------------------------------------------------------------------- */

// Each pattern is a typical mojibake sequence (UTF-8 bytes read as Latin-1/CP1252).
const MOJIBAKE_PATTERNS = [
  { label: 'U+FFFD (caracter de reemplazo)', re: /\uFFFD/ },
  { label: 'A-tilde seguido de U+0080-U+00BF', re: /\u00C3[\u0080-\u00BF]/ },
  { label: 'A-circunflejo seguido de U+00A0-U+00BF', re: /\u00C2[\u00A0-\u00BF]/ },
  { label: 'a-circunflejo + euro (comillas o guiones corruptos)', re: /\u00E2\u20AC/ },
];

const ENCODING_TARGETS = [
  'supabase/migrations/154_seguimiento_cedularios_alumno.sql',
  'messages/es.json',
  'messages/en.json',
  'lib/cedularios/seguimiento',
  'lib/queries/cedularios/seguimiento',
  'app/actions/cedularios/seguimiento',
  'components/cedularios',
  'components/common/HoverCard',
  'lib/validations/cedularioSeguimiento.schema.ts',
];

const TEXT_EXTS = ['.ts', '.tsx', '.json', '.sql', '.css', '.md'];

function runEncoding() {
  const report = createReport('encoding');
  const files = collectAll(ENCODING_TARGETS, TEXT_EXTS);
  for (const file of files) {
    const lines = readText(file).split(/\r?\n/);
    lines.forEach((text, idx) => {
      for (const { label, re } of MOJIBAKE_PATTERNS) {
        if (re.test(text)) {
          report.fail(`${rel(file)}:${idx + 1}: ${label}`);
        }
      }
    });
  }
  report.note(`${files.length} archivos revisados`);
  return report;
}

/* -------------------------------------------------------------------------- */
/* --static                                                                   */
/* -------------------------------------------------------------------------- */

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g;
const HEX_TARGETS = ['components/cedularios/seguimiento', 'components/common/HoverCard'];

function checkHexColors(report) {
  const files = collectAll(HEX_TARGETS, ['.ts', '.tsx', '.css']);
  for (const file of files) {
    const src = stripComments(readText(file));
    HEX_COLOR.lastIndex = 0;
    let m;
    while ((m = HEX_COLOR.exec(src)) !== null) {
      report.fail(`${rel(file)}:${lineOf(src, m.index)}: color hexadecimal ${m[0]} (usar variables CSS)`);
    }
  }
  report.note(`colores: ${files.length} archivos revisados`);
}

function isForbiddenImport(spec, typeOnly) {
  if (spec === 'react' || spec.startsWith('react/') || spec === 'react-dom' || spec.startsWith('react-dom/')) {
    return true;
  }
  if (spec.startsWith('@supabase/')) return true;
  if (spec === '@/lib/supabase' || spec.startsWith('@/lib/supabase/')) {
    return !(typeOnly && spec === '@/lib/supabase/types');
  }
  return false;
}

/** True for `{ type A, type B as C }`: every specifier is type-only. */
function isInlineTypeOnly(clause) {
  const body = clause.trim().match(/^\{([\s\S]*)\}$/);
  if (!body) return false;
  const parts = body[1].split(',').map((p) => p.trim()).filter((p) => p !== '');
  return parts.length > 0 && parts.every((p) => /^type\s+/.test(p));
}

function checkDomainImports(report) {
  const files = collectAll(['lib/cedularios/seguimiento'], ['.ts', '.tsx']);
  for (const file of files) {
    const src = stripComments(readText(file));
    const found = [];
    const importRe = /\bimport\s+(type\s+)?(?:([^'"`;]*?)\s+from\s+)?(['"])([^'"]+)\3/g;
    let m;
    while ((m = importRe.exec(src)) !== null) {
      const typeOnly = Boolean(m[1]) || (m[2] !== undefined && isInlineTypeOnly(m[2]));
      found.push({ index: m.index, spec: m[4], typeOnly });
    }
    const reexportRe = /\bexport\s+(type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+(['"])([^'"]+)\2/g;
    while ((m = reexportRe.exec(src)) !== null) {
      found.push({ index: m.index, spec: m[3], typeOnly: Boolean(m[1]) });
    }
    const dynamicRe = /\b(?:import|require)\s*\(\s*(['"])([^'"]+)\1/g;
    while ((m = dynamicRe.exec(src)) !== null) {
      found.push({ index: m.index, spec: m[2], typeOnly: false });
    }
    for (const item of found) {
      if (isForbiddenImport(item.spec, item.typeOnly)) {
        report.fail(`${rel(file)}:${lineOf(src, item.index)}: import prohibido en la capa de dominio: ${item.spec}`);
      }
    }
  }
  report.note(`dominio: ${files.length} archivos revisados`);
}

function checkServerActions(report) {
  const files = collectAll(['app/actions/cedularios/seguimiento'], ['.ts', '.tsx']);
  for (const file of files) {
    const src = stripComments(readText(file));
    if (!/^\s*(['"])use server\1/.test(src)) {
      report.fail(`${rel(file)}:1: el archivo debe empezar con 'use server'`);
    }
    const lines = src.split(/\r?\n/);
    lines.forEach((text, idx) => {
      if (!/^export\b/.test(text)) return;
      const ok =
        /^export\s+(?:default\s+)?async\s+function\b/.test(text) ||
        /^export\s+const\s+[\w$]+\s*(?::[^=]+)?=\s*async\b/.test(text) ||
        // Type-only exports are erased at compile time and are allowed.
        /^export\s+(?:declare\s+)?(?:type|interface)\b/.test(text);
      if (!ok) {
        report.fail(`${rel(file)}:${idx + 1}: export que no es una funcion async: ${text.trim().slice(0, 80)}`);
      }
    });
  }
  report.note(`acciones: ${files.length} archivos revisados`);
}

function runStatic() {
  const report = createReport('static');
  checkHexColors(report);
  checkDomainImports(report);
  checkServerActions(report);
  return report;
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

const CHECKS = {
  '--i18n': runI18n,
  '--encoding': runEncoding,
  '--static': runStatic,
};

function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => !(a in CHECKS));
  if (unknown.length > 0) {
    console.error(`Opciones desconocidas: ${unknown.join(' ')}`);
    console.error('Uso: node scripts/verificar-seguimiento.mjs [--i18n] [--encoding] [--static]');
    process.exit(2);
  }
  const selected = args.length === 0 ? Object.keys(CHECKS) : [...new Set(args)];

  let failed = false;
  for (const option of selected) {
    const report = CHECKS[option]();
    const status = report.failures.length === 0 ? 'OK' : 'FALLA';
    console.log(`\n[${option}] ${status}`);
    for (const note of report.notes) console.log(`  . ${note}`);
    for (const warning of report.warnings) console.log(`  ADVERTENCIA ${warning}`);
    for (const failure of report.failures) console.log(`  ERROR ${failure}`);
    if (report.failures.length > 0) failed = true;
  }
  console.log(failed ? '\nVerificacion con errores.' : '\nVerificacion correcta.');
  process.exit(failed ? 1 : 0);
}

main();
