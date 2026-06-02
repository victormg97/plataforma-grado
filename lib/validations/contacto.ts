// Helpers de validación de contacto (email y teléfono), usables tanto en el
// cliente como en el servidor. Sin dependencias externas.
//
// Filosofía del email: la validación es una AYUDA, no un muro. Solo se considera
// INVÁLIDO lo genuinamente malformado (sin `@`, sin TLD, caracteres ilegales,
// longitudes fuera de rango). Las erratas comunes (p. ej. `gmail.con`,
// `gmial.com`) NO bloquean: se aceptan como válidas y se ofrece una SUGERENCIA
// de corrección que el usuario puede aplicar o ignorar. Esto permite correos
// institucionales arbitrarios (p. ej. `juan@alumnos.ucn.cl`) sin fricción.
//
// Teléfono: normalización + validación estilo E.164 (7 a 15 dígitos, prefijo
// `+` opcional, separadores comunes permitidos).

// ─── Distancia de Levenshtein (algoritmo clásico) ─────────────────────────────

/** Distancia de edición entre dos cadenas (inserción/borrado/sustitución). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 0; i < a.length; i++) {
    curr[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr[j + 1] = Math.min(
        curr[j] + 1, // inserción
        prev[j + 1] + 1, // borrado
        prev[j] + cost, // sustitución
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// ─── Email ────────────────────────────────────────────────────────────────────

// Regex de sintaxis de email del estándar WHATWG (HTML living standard).
// Exige al menos un punto en el dominio (es decir, un TLD).
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Dominios de consumo populares. Solo estos se usan para detectar erratas de
// DOMINIO (p. ej. `gmial.com` → `gmail.com`). Deliberadamente NO incluye
// dominios institucionales/cortos (uc.cl, ucn.cl, etc.) para no generar
// sugerencias falsas sobre correos universitarios legítimos.
const DOMINIOS_CONSUMO = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.es',
  'hotmail.cl',
  'outlook.com',
  'outlook.es',
  'outlook.cl',
  'live.com',
  'live.cl',
  'yahoo.com',
  'yahoo.es',
  'yahoo.cl',
  'icloud.com',
  'protonmail.com',
  'proton.me',
];

// TLDs reales reconocidos. Si el TLD del correo está aquí, NUNCA se sugiere una
// corrección de TLD (se asume válido). Incluye gTLDs comunes y ccTLDs (con foco
// en Latinoamérica/Iberia). No es exhaustivo, pero cubre los casos frecuentes;
// un TLD real que falte aquí simplemente no recibe sugerencia (sigue válido).
const TLDS_VALIDOS = new Set([
  // gTLDs comunes
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name',
  'io', 'co', 'me', 'app', 'dev', 'xyz', 'online', 'site', 'tech', 'cloud',
  'pro', 'live', 'email', 'us',
  // ccTLDs Latinoamérica / Iberia / frecuentes
  'cl', 'ar', 'pe', 'mx', 'bo', 'br', 'uy', 'py', 'ec', 've', 'cr', 'pa',
  'gt', 'hn', 'sv', 'ni', 'do', 'cu', 'pr',
  'es', 'pt', 'fr', 'it', 'de', 'uk', 'ca', 'au',
]);

// TLDs comunes contra los que se mide la distancia para detectar erratas
// (p. ej. `con` → `com`, `ne` → `net`). Solo se sugiere si el TLD del correo
// NO es un TLD válido conocido.
const TLDS_COMUNES_PARA_ERRATAS = ['com', 'net', 'org', 'edu', 'cl', 'es', 'co'];

export interface ResultadoEmail {
  /**
   * `true` salvo que el correo sea genuinamente malformado (sintaxis WHATWG o
   * longitudes). Las erratas comunes NO ponen esto en `false`: solo generan
   * `sugerencia`.
   */
  valido: boolean;
  /** Corrección sugerida (errata de dominio o TLD), si se detectó alguna. */
  sugerencia?: string;
}

/**
 * Valida la sintaxis de un correo y, de forma NO bloqueante, sugiere una
 * corrección ante erratas comunes.
 *
 * - `valido: false` SOLO para correos malformados (no cumplen la sintaxis
 *   WHATWG, sin TLD, parte local > 64, total > 254).
 * - Para correos sintácticamente válidos, `valido` siempre es `true`; si se
 *   detecta una posible errata se añade `sugerencia` (el usuario decide).
 */
export function validarEmail(emailRaw: string): ResultadoEmail {
  const email = emailRaw.trim().toLowerCase();

  if (!email) return { valido: false };
  if (email.length > 254) return { valido: false };
  if (!EMAIL_REGEX.test(email)) return { valido: false };

  const [local, dominio] = email.split('@');
  if (!local || local.length > 64 || !dominio) {
    return { valido: false };
  }

  // A partir de aquí el correo es sintácticamente válido → nunca se bloquea.
  const partes = dominio.split('.');
  const tld = partes[partes.length - 1];
  const dominioBase = partes.slice(0, -1).join('.'); // p. ej. "alumnos.ucn"

  // 1. Sugerencia por errata de DOMINIO de consumo (gmial.com → gmail.com).
  //    Solo contra proveedores de consumo; nunca contra institucionales.
  if (!DOMINIOS_CONSUMO.includes(dominio)) {
    let mejor: { dominio: string; dist: number } | null = null;
    for (const conocido of DOMINIOS_CONSUMO) {
      const dist = levenshtein(dominio, conocido);
      if (dist > 0 && dist <= 2 && (!mejor || dist < mejor.dist)) {
        mejor = { dominio: conocido, dist };
      }
    }
    if (mejor) {
      return { valido: true, sugerencia: `${local}@${mejor.dominio}` };
    }
  }

  // 2. Sugerencia por errata de TLD (gmail.con → gmail.com), solo si el TLD no
  //    es ya un TLD válido conocido. Esto evita tocar correos como `@algo.co`.
  if (!TLDS_VALIDOS.has(tld)) {
    for (const tldComun of TLDS_COMUNES_PARA_ERRATAS) {
      if (levenshtein(tld, tldComun) === 1) {
        return { valido: true, sugerencia: `${local}@${dominioBase}.${tldComun}` };
      }
    }
  }

  return { valido: true };
}

// ─── Teléfono ───────────────────────────────────────────────────────────────

export interface ResultadoTelefono {
  valido: boolean;
  /** Número normalizado (solo dígitos con `+` inicial opcional). */
  normalizado: string;
}

/**
 * Valida un número de teléfono con criterio estilo E.164:
 *  - Se permiten separadores comunes en la entrada: espacios, guiones, puntos y
 *    paréntesis, además de un prefijo `+` inicial opcional.
 *  - Tras normalizar, el resto debe ser solo dígitos.
 *  - La cantidad de dígitos debe estar entre 7 y 15 (máximo E.164).
 */
export function validarTelefono(telefonoRaw: string): ResultadoTelefono {
  const original = telefonoRaw.trim();
  if (!original) return { valido: false, normalizado: '' };

  // Solo se aceptan dígitos, espacios, +, -, ., (, ) en la entrada.
  if (!/^[+\d\s().-]+$/.test(original)) {
    return { valido: false, normalizado: '' };
  }

  const tienePrefijo = original.startsWith('+');
  const soloDigitos = original.replace(/\D/g, '');

  if (soloDigitos.length < 7 || soloDigitos.length > 15) {
    return { valido: false, normalizado: '' };
  }

  return {
    valido: true,
    normalizado: `${tienePrefijo ? '+' : ''}${soloDigitos}`,
  };
}
