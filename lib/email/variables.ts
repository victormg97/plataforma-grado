/**
 * Motor de sustitución de Variables_Dinamicas del módulo de correo (`lib/email/`).
 *
 * Este archivo es agnóstico del entorno (no importa nada del lado del servidor),
 * por lo que puede usarse tanto en el orquestador de envío como en la interfaz del
 * Editor_Plantillas para listar las variables disponibles por tipo de correo.
 *
 * Cubre dos responsabilidades:
 *  - `variablesDisponibles(tipo)`: enumera las Variables_Dinamicas que un
 *    Usuario_Editor puede insertar en la plantilla de un tipo de correo, con su
 *    token (`{clave}`) y la clave i18n de su descripción (Requisito 8.1, 8.4, 15.5).
 *  - `sustituirVariables(plantilla, valores)`: reemplaza cada token conocido por
 *    su valor real al construir el correo (Requisito 8.3, 8.5, 9.2, 9.3, 9.4).
 */

import type { TipoCorreo, VariablesCorreo } from './types';

/**
 * Definición de una Variable_Dinamica para el Editor_Plantillas.
 *
 * _Requisito 8.1_: cada variable disponible se muestra con su token insertable y
 * una descripción legible (obtenida vía i18n a partir de `claveDescripcion`).
 */
export interface DefinicionVariable {
  /** Marcador de posición insertable en la plantilla, p.ej. `'{hora_inicio}'`. */
  token: string;
  /** Clave i18n completa de la descripción, p.ej. `'plantillasCorreo.variables.hora_inicio'`. */
  claveDescripcion: string;
}

/**
 * Prefijo i18n común a todas las descripciones de Variables_Dinamicas.
 *
 * Las claves viven en `messages/es.json` y `messages/en.json` bajo el namespace
 * `plantillasCorreo.variables.<clave>` (Requisito 13).
 */
const PREFIJO_I18N = 'plantillasCorreo.variables' as const;

/**
 * Claves base de las Variables_Dinamicas comunes a TODOS los tipos de correo.
 *
 * Se corresponden 1:1 con campos de `VariablesCorreo`. A partir de cada clave se
 * derivan tanto el token (`{clave}`) como la `claveDescripcion`
 * (`plantillasCorreo.variables.<clave>`), evitando literales duplicados.
 *
 * _Requisito 8.4_: incluye nombre del destinatario, nombre del alumno, título de
 * la clase, fecha, `hora_inicio`, `hora_fin` y `enlace_clase`.
 */
const CLAVES_COMUNES = [
  'nombre_destinatario',
  'nombre_alumno',
  'titulo_clase',
  'descripcion_clase',
  'fecha',
  'hora_inicio',
  'hora_fin',
  'enlace_clase',
] as const satisfies readonly (keyof VariablesCorreo)[];

/**
 * Claves base de las Variables_Dinamicas específicas del tipo
 * `solicitud_cambio_horario`, añadidas a las comunes para ese tipo.
 *
 * _Requisito 15.5_: fecha propuesta, hora de inicio propuesta, hora de fin
 * propuesta y nota del alumno.
 */
const CLAVES_SOLICITUD_CAMBIO = [
  'fecha_propuesta',
  'hora_inicio_propuesta',
  'hora_fin_propuesta',
  'nota_alumno',
] as const satisfies readonly (keyof VariablesCorreo)[];

/**
 * Claves base de las Variables_Dinamicas específicas del tipo
 * `invitacion_acceso`, añadidas al nombre del destinatario para ese tipo.
 *
 * _Requisito 19.4_: enlace de acceso (`${NEXT_PUBLIC_APP_URL}/setup/${code}`) y
 * correo con el que el usuario recién creado accederá. Este tipo NO incluye las
 * variables de clase comunes.
 */
const CLAVES_INVITACION = [
  'enlace_acceso',
  'email_acceso',
] as const satisfies readonly (keyof VariablesCorreo)[];

/**
 * Claves base de las Variables_Dinamicas específicas del tipo
 * `bienvenida_registro`.
 *
 * Cuando el usuario se auto-registra mediante un enlace de invitación, ya tiene
 * sesión activa. Solo se incluye el nombre del destinatario y una descripción de
 * acceso adaptada al rol (`{descripcion_acceso}`).
 */
const CLAVES_BIENVENIDA_REGISTRO = [
  'descripcion_acceso',
] as const satisfies readonly (keyof VariablesCorreo)[];

/**
 * Claves base de las Variables_Dinamicas específicas del tipo
 * `nueva_nota_clase`.
 *
 * Incluye el contenido de la nota, el nombre del autor y las variables comunes
 * de la clase asociada.
 */
const CLAVES_NUEVA_NOTA_CLASE = [
  'contenido_nota',
  'nombre_autor',
] as const satisfies readonly (keyof VariablesCorreo)[];

/**
 * Conjunto completo de claves conocidas por el motor (las 14 claves de
 * `VariablesCorreo`).
 *
 * Es la única fuente de verdad para `sustituirVariables`: garantiza que la
 * sustitución y `variablesDisponibles` permanezcan coherentes entre sí. El tipo
 * derivado fuerza, en tiempo de compilación, que solo contenga claves válidas de
 * `VariablesCorreo`.
 */
const CLAVES_CONOCIDAS = [
  ...CLAVES_COMUNES,
  ...CLAVES_SOLICITUD_CAMBIO,
  ...CLAVES_INVITACION,
  ...CLAVES_BIENVENIDA_REGISTRO,
  ...CLAVES_NUEVA_NOTA_CLASE,
] as const satisfies readonly (keyof VariablesCorreo)[];

/** Construye el token insertable (`{clave}`) a partir de una clave base. */
function token(clave: keyof VariablesCorreo): string {
  return `{${clave}}`;
}

/** Deriva una `DefinicionVariable` (token + clave i18n) a partir de una clave base. */
function definicion(clave: keyof VariablesCorreo): DefinicionVariable {
  return {
    token: token(clave),
    claveDescripcion: `${PREFIJO_I18N}.${clave}`,
  };
}

/**
 * Devuelve las Variables_Dinamicas disponibles para un tipo de correo.
 *
 * La mayoría de los tipos incluyen las variables comunes (Requisito 8.4). El tipo
 * `solicitud_cambio_horario` añade además las variables de la propuesta de cambio
 * (Requisito 15.5). El tipo `invitacion_acceso` no se refiere a una clase, por lo
 * que ofrece solo el nombre del destinatario y las variables de acceso
 * (Requisito 19.4). El tipo `nueva_clase` usa las variables comunes (Requisito 18.9).
 *
 * @param tipo Tipo de correo cuya plantilla se está editando.
 * @returns Lista de definiciones (token + clave i18n de descripción).
 */
export function variablesDisponibles(tipo: TipoCorreo): DefinicionVariable[] {
  let claves: readonly (keyof VariablesCorreo)[];

  switch (tipo) {
    case 'solicitud_cambio_horario':
      claves = [...CLAVES_COMUNES, ...CLAVES_SOLICITUD_CAMBIO];
      break;
    case 'invitacion_acceso':
      claves = ['nombre_destinatario', ...CLAVES_INVITACION];
      break;
    case 'bienvenida_registro':
      claves = ['nombre_destinatario', ...CLAVES_BIENVENIDA_REGISTRO];
      break;
    case 'nueva_clase':
      claves = CLAVES_COMUNES;
      break;
    case 'nueva_nota_clase':
      claves = ['nombre_destinatario', 'nombre_autor', 'contenido_nota', 'titulo_clase', 'fecha', 'hora_inicio', 'hora_fin', 'enlace_clase'];
      break;
    default:
      claves = CLAVES_COMUNES;
      break;
  }

  return claves.map(definicion);
}

/**
 * Sustituye en la plantilla cada token de Variable_Dinamica conocida por su valor
 * real correspondiente al evento.
 *
 * - Reemplaza TODAS las apariciones de cada token conocido (Requisito 8.3). Para
 *   evitar problemas con los caracteres especiales de regex de las llaves, el
 *   reemplazo se hace por coincidencia literal mediante `split`/`join`.
 * - Un token cuyo valor sea `undefined` o `null` se reemplaza por cadena vacía
 *   (Requisito 8.5, 9.4).
 * - Los tokens que no aparecen en la plantilla simplemente no se insertan; iterar
 *   sobre las claves conocidas no añade contenido inexistente (Requisito 9.3).
 *
 * @param plantilla Texto de la plantilla (asunto o cuerpo) con tokens `{clave}`.
 * @param valores Valores reales de las Variables_Dinamicas para el evento.
 * @returns El texto con todos los tokens conocidos sustituidos.
 */
export function sustituirVariables(plantilla: string, valores: VariablesCorreo): string {
  let resultado = plantilla;

  for (const clave of CLAVES_CONOCIDAS) {
    const valor = valores[clave];
    const reemplazo = valor ?? '';
    resultado = resultado.split(token(clave)).join(reemplazo);
  }

  return resultado;
}
