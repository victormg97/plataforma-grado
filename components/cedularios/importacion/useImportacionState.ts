'use client';

import { useCallback, useMemo, useReducer } from 'react';
import {
  aplanarArbol,
  parsearTexto,
  profundidadMaxima,
  validarArbol,
  type Advertencia,
  type MetadatosDetectados,
  type NodoImportacion,
  type UniversidadRef,
} from '@/lib/cedularios/importacion';
import {
  agregar,
  agregarRaiz,
  desindentar,
  eliminar,
  fusionarConAnterior,
  mover,
  renombrar,
  sangrar,
} from '@/lib/cedularios/importacion/edicion';

const MAX_DESHACER = 50;

export type OperacionArbol =
  | { tipo: 'renombrar'; key: string; nombre: string }
  | { tipo: 'sangrar'; key: string }
  | { tipo: 'desindentar'; key: string }
  | { tipo: 'mover'; key: string; delta: -1 | 1 }
  | { tipo: 'eliminar'; key: string }
  | { tipo: 'fusionar'; key: string }
  | { tipo: 'agregar'; key: string; nuevaKey: string; comoHijo: boolean }
  | { tipo: 'agregar_raiz'; nuevaKey: string };

interface Estado {
  /** Source text as read from the file (editable in the raw text panel). */
  texto: string;
  nombreArchivo: string | null;
  raiz: NodoImportacion[];
  metadatos: MetadatosDetectados;
  /** Soft warnings produced by the parser (hard errors are recomputed from the tree). */
  avisosParser: Advertencia[];
  deshacer: NodoImportacion[][];
  rehacer: NodoImportacion[][];
  cargado: boolean;
}

type Accion =
  | { tipo: 'cargar'; texto: string; nombreArchivo: string | null; universidades: readonly UniversidadRef[] }
  | { tipo: 'reparsear'; texto: string; universidades: readonly UniversidadRef[] }
  | { tipo: 'operar'; op: OperacionArbol }
  | { tipo: 'deshacer' }
  | { tipo: 'rehacer' }
  | { tipo: 'reiniciar' };

const METADATOS_VACIOS: MetadatosDetectados = {
  nombre: null,
  version: null,
  universidadTexto: null,
  universidadId: null,
};

const INICIAL: Estado = {
  texto: '',
  nombreArchivo: null,
  raiz: [],
  metadatos: METADATOS_VACIOS,
  avisosParser: [],
  deshacer: [],
  rehacer: [],
  cargado: false,
};

function aplicarOperacion(raiz: NodoImportacion[], op: OperacionArbol): NodoImportacion[] {
  switch (op.tipo) {
    case 'renombrar':
      return renombrar(raiz, op.key, op.nombre);
    case 'sangrar':
      return sangrar(raiz, op.key);
    case 'desindentar':
      return desindentar(raiz, op.key);
    case 'mover':
      return mover(raiz, op.key, op.delta);
    case 'eliminar':
      return eliminar(raiz, op.key);
    case 'fusionar':
      return fusionarConAnterior(raiz, op.key);
    case 'agregar':
      return agregar(raiz, op.key, op.nuevaKey, op.comoHijo);
    case 'agregar_raiz':
      return agregarRaiz(raiz, op.nuevaKey);
  }
}

function conSnapshot(estado: Estado, raiz: NodoImportacion[]): Estado {
  if (raiz === estado.raiz) return estado;
  return {
    ...estado,
    raiz,
    deshacer: [...estado.deshacer, estado.raiz].slice(-MAX_DESHACER),
    rehacer: [],
  };
}

function reducer(estado: Estado, accion: Accion): Estado {
  switch (accion.tipo) {
    case 'cargar': {
      const r = parsearTexto(accion.texto, { universidades: accion.universidades });
      return {
        texto: accion.texto,
        nombreArchivo: accion.nombreArchivo,
        raiz: r.raiz,
        metadatos: r.metadatos,
        avisosParser: r.advertencias.filter((a) => a.severidad === 'aviso'),
        deshacer: [],
        rehacer: [],
        cargado: true,
      };
    }
    case 'reparsear': {
      const r = parsearTexto(accion.texto, { universidades: accion.universidades });
      return {
        ...conSnapshot(estado, r.raiz),
        texto: accion.texto,
        metadatos: r.metadatos,
        avisosParser: r.advertencias.filter((a) => a.severidad === 'aviso'),
      };
    }
    case 'operar':
      return conSnapshot(estado, aplicarOperacion(estado.raiz, accion.op));
    case 'deshacer': {
      const anterior = estado.deshacer.at(-1);
      if (!anterior) return estado;
      return {
        ...estado,
        raiz: anterior,
        deshacer: estado.deshacer.slice(0, -1),
        rehacer: [...estado.rehacer, estado.raiz],
      };
    }
    case 'rehacer': {
      const siguiente = estado.rehacer.at(-1);
      if (!siguiente) return estado;
      return {
        ...estado,
        raiz: siguiente,
        deshacer: [...estado.deshacer, estado.raiz],
        rehacer: estado.rehacer.slice(0, -1),
      };
    }
    case 'reiniciar':
      return INICIAL;
  }
}

/** Editable tree of the importer: parse, edit operations, undo / redo and live validation. */
export function useImportacionState(universidades: readonly UniversidadRef[]) {
  const [estado, dispatch] = useReducer(reducer, INICIAL);

  const cargar = useCallback(
    (texto: string, nombreArchivo: string | null) =>
      dispatch({ tipo: 'cargar', texto, nombreArchivo, universidades }),
    [universidades],
  );
  const reparsear = useCallback(
    (texto: string) => dispatch({ tipo: 'reparsear', texto, universidades }),
    [universidades],
  );
  const operar = useCallback((op: OperacionArbol) => dispatch({ tipo: 'operar', op }), []);
  const deshacer = useCallback(() => dispatch({ tipo: 'deshacer' }), []);
  const rehacer = useCallback(() => dispatch({ tipo: 'rehacer' }), []);
  const reiniciar = useCallback(() => dispatch({ tipo: 'reiniciar' }), []);

  const derivado = useMemo(() => {
    const planas = aplanarArbol(estado.raiz);
    const claves = new Set(planas.map((p) => p.key));
    const errores = validarArbol(estado.raiz);
    const avisos = estado.avisosParser.filter((a) => a.nodoKey === undefined || claves.has(a.nodoKey));
    const advertencias = [...errores, ...avisos];
    return {
      planas,
      advertencias,
      hayErrores: advertencias.some((a) => a.severidad === 'error'),
      profundidad: profundidadMaxima(estado.raiz),
    };
  }, [estado.raiz, estado.avisosParser]);

  return {
    estado,
    ...derivado,
    puedeDeshacer: estado.deshacer.length > 0,
    puedeRehacer: estado.rehacer.length > 0,
    cargar,
    reparsear,
    operar,
    deshacer,
    rehacer,
    reiniciar,
  };
}

export type ImportacionState = ReturnType<typeof useImportacionState>;
