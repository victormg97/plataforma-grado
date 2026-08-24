import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/* ------------------------------------------------------------------------- *
 * Aislamiento de los slices de agenda (Requisitos 17.3, 17.4, 17.5, 17.9)
 *
 * El grafo de slices tiene tres niveles:
 *   nivel 0            -> `compartido` (utilidades sin dominio) y `nucleo` (modelo)
 *   nivel 1            -> `solapamiento`, `visibilidad`, `conexion` (reglas transversales)
 *   nivel 2 (capacidad)-> los cinco de SLICES_CAPACIDAD, mutuamente ciegos
 *
 * Los puntos de composición (`app/api/agenda/**` y `components/calendario/**`)
 * importan varios slices a propósito, así que no reciben la regla de nivel 2.
 * ------------------------------------------------------------------------- */

/** Slices de capacidad: no pueden depender entre sí (Requisito 17.5). */
const SLICES_CAPACIDAD = [
  "entradas-personales",
  "actividades",
  "ocultacion",
  "calendario",
  "notificaciones",
];

/** Ficheros de código de cada árbol de la funcionalidad. */
const CODIGO_LIB_AGENDA = ["lib/agenda/**/*.ts", "lib/agenda/**/*.tsx"];
const CODIGO_UI_AGENDA = ["components/agenda/**/*.ts", "components/agenda/**/*.tsx"];
const CODIGO_API_AGENDA = ["app/api/agenda/**/*.ts", "app/api/agenda/**/*.tsx"];

/**
 * Nadie importa archivos internos de un slice: solo su `Punto_Entrada_Slice`
 * (Requisito 17.3). El segundo patrón cubre además los subdirectorios
 * (`@/lib/agenda/<slice>/hooks/...`).
 *
 * Excepción: los barrels secundarios `index.servidor` son puntos de entrada
 * válidos para código de servidor que no puede mezclarse en bundles de cliente.
 */
const PATRON_PUNTO_ENTRADA = {
  group: [
    "@/lib/agenda/*/!(index|index.servidor)",
    "@/lib/agenda/*/**",
  ],
  message:
    "Importa el Punto_Entrada_Slice (@/lib/agenda/<slice>) o su barrel de servidor (index.servidor), no un archivo interno (Requisito 17.3).",
};

// Cruzar el límite de un slice con rutas relativas oculta la arista del grafo.
// El primer patrón es el salto a un hermano desde la raíz del slice; los otros dos
// cubren cualquier salto fuera del slice desde un subdirectorio.
const PATRON_CRUCE_RELATIVO = {
  group: ["../*/*", "../../*", "../../**"],
  message:
    "Cruzar el límite de un slice con rutas relativas está prohibido; usa @/lib/agenda/<slice> (Requisito 17.3).",
};

/** El dominio no depende de la interfaz: `lib/agenda/**` nunca importa componentes. */
const PATRON_SIN_INTERFAZ = {
  group: ["@/components/*", "@/components/**"],
  message:
    "El dominio no depende de la interfaz: mueve el tipo o la utilidad a lib/ y consúmela desde ahí.",
};

/** `no-restricted-imports` con la lista de patrones dada. */
const restringirImportaciones = (patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

const reglasAislamientoAgenda = [
  // Dominio y servidor: punto de entrada, sin cruces relativos y sin interfaz.
  {
    files: CODIGO_LIB_AGENDA,
    rules: restringirImportaciones([
      PATRON_PUNTO_ENTRADA,
      PATRON_CRUCE_RELATIVO,
      PATRON_SIN_INTERFAZ,
    ]),
  },
  // Interfaz y rutas: punto de entrada y sin cruces relativos.
  {
    files: [...CODIGO_UI_AGENDA, ...CODIGO_API_AGENDA],
    rules: restringirImportaciones([PATRON_PUNTO_ENTRADA, PATRON_CRUCE_RELATIVO]),
  },
  // Nivel 2: un slice de capacidad no puede importar otro slice de capacidad.
  // En la configuración plana las reglas no se fusionan, así que cada bloque
  // repite los patrones anteriores además del suyo.
  ...SLICES_CAPACIDAD.map((slice) => ({
    files: [`lib/agenda/${slice}/**/*.ts`, `lib/agenda/${slice}/**/*.tsx`],
    rules: restringirImportaciones([
      PATRON_PUNTO_ENTRADA,
      PATRON_CRUCE_RELATIVO,
      PATRON_SIN_INTERFAZ,
      {
        group: SLICES_CAPACIDAD
          .filter((otro) => otro !== slice)
          .map((otro) => `@/lib/agenda/${otro}`),
        message:
          "Los slices de capacidad no pueden depender entre sí (Requisito 17.5). Compón en el route handler (app/api/agenda/) o en el calendario (components/calendario/).",
      },
    ]),
  })),
  // Nivel 0: `compartido` no importa nada del proyecto, ni por alias ni por ruta
  // relativa fuera del slice. Es la raíz del grafo (Requisito 17.4).
  {
    files: ["lib/agenda/compartido/**/*.ts", "lib/agenda/compartido/**/*.tsx"],
    rules: restringirImportaciones([
      {
        group: ["@/*", "@/**", "../*", "../**"],
        message:
          "El slice `compartido` es el nivel 0 del grafo: solo puede importar de sí mismo y de paquetes externos (Requisito 17.4).",
      },
    ]),
  },
  // Requisito 17.9 — aviso, no error, para no bloquear el desarrollo.
  {
    files: [...CODIGO_LIB_AGENDA, ...CODIGO_UI_AGENDA],
    rules: {
      "max-lines": ["warn", { max: 400, skipBlankLines: false, skipComments: false }],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Minified vendor files
    "public/**/*.min.*",
    "public/**/*.min.mjs",
  ]),
  // Aislamiento de los slices de agenda (Requisitos 17.3, 17.4, 17.5, 17.9).
  ...reglasAislamientoAgenda,
]);

export default eslintConfig;
