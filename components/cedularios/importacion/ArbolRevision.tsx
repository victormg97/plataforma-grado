'use client';

import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Indent,
  Merge,
  Outdent,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { ancestrosDe } from '@/lib/cedularios/importacion/edicion';
import { LIMITES_IMPORTACION, type Advertencia, type NodoImportacion } from '@/lib/cedularios/importacion';
import { cn } from '@/lib/utils';
import type { OperacionArbol } from './useImportacionState';

export interface ArbolRevisionHandle {
  /** Expands the ancestors of the item, scrolls to it and focuses its row. */
  irA: (key: string) => void;
}

interface FilaVisible {
  nodo: NodoImportacion;
  nivel: number;
  indice: number;
  hermanos: number;
}

interface ArbolRevisionProps {
  raiz: NodoImportacion[];
  advertencias: readonly Advertencia[];
  onOperar: (op: OperacionArbol) => void;
  handleRef?: Ref<ArbolRevisionHandle>;
}

const CLASE_ICONO =
  'flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] disabled:pointer-events-none disabled:opacity-40';

function aplanarVisibles(raiz: readonly NodoImportacion[], colapsados: ReadonlySet<string>): FilaVisible[] {
  const filas: FilaVisible[] = [];
  const visitar = (lista: readonly NodoImportacion[], nivel: number) => {
    lista.forEach((nodo, indice) => {
      filas.push({ nodo, nivel, indice, hermanos: lista.length });
      if (!colapsados.has(nodo.key)) visitar(nodo.children, nivel + 1);
    });
  };
  visitar(raiz, 1);
  return filas;
}

/** Keyboard accessible, editable tree (ARIA `tree`, roving tabindex). */
export function ArbolRevision({ raiz, advertencias, onOperar, handleRef }: ArbolRevisionProps) {
  const t = useTranslations('cedularios.importacion.arbol');
  const idBase = useId();
  const [colapsados, setColapsados] = useState<ReadonlySet<string>>(() => new Set());
  const [activaKey, setActivaKey] = useState<string | null>(null);
  const [editandoKey, setEditandoKey] = useState<string | null>(null);
  const pendienteFoco = useRef<string | null>(null);
  const [, setRenderizado] = useState(0);
  // Asks to focus a row after the next render (the row may not exist yet).
  const setPendienteFoco = useCallback((key: string) => {
    pendienteFoco.current = key;
    setRenderizado((n) => n + 1);
  }, []);
  const filasRef = useRef(new Map<string, HTMLElement>());
  const cancelarEdicion = useRef(false);

  const filas = useMemo(() => aplanarVisibles(raiz, colapsados), [raiz, colapsados]);
  const porNodo = useMemo(() => {
    const mapa = new Map<string, { errores: number; avisos: number }>();
    for (const a of advertencias) {
      if (a.nodoKey === undefined) continue;
      const actual = mapa.get(a.nodoKey) ?? { errores: 0, avisos: 0 };
      if (a.severidad === 'error') actual.errores += 1;
      else actual.avisos += 1;
      mapa.set(a.nodoKey, actual);
    }
    return mapa;
  }, [advertencias]);

  // The active row must exist in the visible list (it can be deleted or hidden by an edit).
  const activaVisible = filas.some((f) => f.nodo.key === activaKey);
  const activaEfectiva = activaVisible ? activaKey : (filas[0]?.nodo.key ?? null);

  useEffect(() => {
    const key = pendienteFoco.current;
    if (key === null) return;
    const el = filasRef.current.get(key);
    if (!el) return;
    pendienteFoco.current = null;
    el.focus();
    el.scrollIntoView?.({ block: 'nearest' });
  });

  const irA = useCallback(
    (key: string) => {
      const ancestros = ancestrosDe(raiz, key);
      setColapsados((previo) => {
        if (!ancestros.some((a) => previo.has(a))) return previo;
        const siguiente = new Set(previo);
        for (const a of ancestros) siguiente.delete(a);
        return siguiente;
      });
      setActivaKey(key);
      setPendienteFoco(key);
    },
    [raiz, setPendienteFoco],
  );
  useImperativeHandle(handleRef, () => ({ irA }), [irA]);

  const alternar = (key: string) =>
    setColapsados((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(key)) siguiente.delete(key);
      else siguiente.add(key);
      return siguiente;
    });

  const agregarItem = (key: string, comoHijo: boolean) => {
    const nuevaKey = `m-${crypto.randomUUID()}`;
    if (comoHijo) setColapsados((p) => (p.has(key) ? new Set([...p].filter((k) => k !== key)) : p));
    onOperar({ tipo: 'agregar', key, nuevaKey, comoHijo });
    setActivaKey(nuevaKey);
    setEditandoKey(nuevaKey);
  };

  const operarYSeguir = (op: OperacionArbol, key: string) => {
    onOperar(op);
    setPendienteFoco(key);
  };

  const eliminarItem = (indice: number) => {
    const fila = filas[indice];
    const vecino = filas[indice + 1]?.nodo.key ?? filas[indice - 1]?.nodo.key ?? null;
    onOperar({ tipo: 'eliminar', key: fila.nodo.key });
    setActivaKey(vecino);
    if (vecino) setPendienteFoco(vecino);
  };

  const alTeclear = (evento: React.KeyboardEvent<HTMLDivElement>, indice: number) => {
    if (evento.target !== evento.currentTarget) return;
    const fila = filas[indice];
    const key = fila.nodo.key;
    const irAIndice = (i: number) => {
      const destino = filas[Math.max(0, Math.min(filas.length - 1, i))];
      if (!destino) return;
      setActivaKey(destino.nodo.key);
      setPendienteFoco(destino.nodo.key);
    };
    const tieneHijos = fila.nodo.children.length > 0;
    const colapsado = colapsados.has(key);
    const alt = evento.altKey;
    let manejado = true;
    switch (evento.key) {
      case 'ArrowDown':
        if (alt) operarYSeguir({ tipo: 'mover', key, delta: 1 }, key);
        else irAIndice(indice + 1);
        break;
      case 'ArrowUp':
        if (alt) operarYSeguir({ tipo: 'mover', key, delta: -1 }, key);
        else irAIndice(indice - 1);
        break;
      case 'ArrowRight':
        if (alt) operarYSeguir({ tipo: 'sangrar', key }, key);
        else if (tieneHijos && colapsado) alternar(key);
        else if (tieneHijos) irAIndice(indice + 1);
        break;
      case 'ArrowLeft':
        if (alt) operarYSeguir({ tipo: 'desindentar', key }, key);
        else if (tieneHijos && !colapsado) alternar(key);
        else {
          const padre = ancestrosDe(raiz, key).at(-1);
          if (padre) irA(padre);
        }
        break;
      case 'Home':
        irAIndice(0);
        break;
      case 'End':
        irAIndice(filas.length - 1);
        break;
      case 'Enter':
      case 'F2':
        setEditandoKey(key);
        break;
      case 'Insert':
        agregarItem(key, alt);
        break;
      case 'Delete':
        eliminarItem(indice);
        break;
      default:
        manejado = false;
    }
    if (manejado) evento.preventDefault();
  };

  const confirmarEdicion = (key: string, valor: string) => {
    setEditandoKey(null);
    if (cancelarEdicion.current) {
      cancelarEdicion.current = false;
      setPendienteFoco(key);
      return;
    }
    onOperar({ tipo: 'renombrar', key, nombre: valor });
    setPendienteFoco(key);
  };

  if (filas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-10 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">{t('vacio')}</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<Plus className="size-4" aria-hidden="true" />}
          onClick={() => {
            const nuevaKey = `m-${crypto.randomUUID()}`;
            onOperar({ tipo: 'agregar_raiz', nuevaKey });
            setActivaKey(nuevaKey);
            setEditandoKey(nuevaKey);
          }}
        >
          {t('agregar_primero')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p id={`${idBase}-ayuda`} className="text-xs text-[var(--color-text-muted)]">
        {t('atajos')}
      </p>
      <div
        role="tree"
        aria-label={t('aria')}
        aria-describedby={`${idBase}-ayuda`}
        className="flex flex-col rounded-[var(--radius-md)] border border-[var(--color-border)]"
      >
        {filas.map((fila, indice) => {
          const { nodo, nivel } = fila;
          const hallazgos = porNodo.get(nodo.key);
          const tieneHijos = nodo.children.length > 0;
          const colapsado = colapsados.has(nodo.key);
          const activa = nodo.key === activaEfectiva;
          const editando = editandoKey === nodo.key;
          const nombreMostrado = nodo.nombre.trim() === '' ? t('sin_nombre') : nodo.nombre;
          return (
            <div
              key={nodo.key}
              ref={(el) => {
                if (el) filasRef.current.set(nodo.key, el);
                else filasRef.current.delete(nodo.key);
              }}
              role="treeitem"
              aria-level={nivel}
              aria-posinset={fila.indice + 1}
              aria-setsize={fila.hermanos}
              aria-expanded={tieneHijos ? !colapsado : undefined}
              aria-selected={activa}
              aria-invalid={hallazgos && hallazgos.errores > 0 ? true : undefined}
              aria-label={t('fila_aria', { codigo: nodo.codigo, nombre: nombreMostrado, nivel })}
              tabIndex={activa ? 0 : -1}
              onFocus={(e) => {
                if (e.target === e.currentTarget) setActivaKey(nodo.key);
              }}
              onKeyDown={(e) => alTeclear(e, indice)}
              className={cn(
                'group flex items-center gap-1.5 border-b border-[var(--color-border)] py-1 pr-2 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand-gold)]',
                hallazgos && hallazgos.errores > 0 && 'bg-[var(--color-error)]/10',
                hallazgos && hallazgos.errores === 0 && hallazgos.avisos > 0 && 'bg-[var(--color-brand-gold-muted)]',
              )}
              style={{ paddingLeft: `${Math.min(nivel - 1, LIMITES_IMPORTACION.profundidad) * 1.25 + 0.25}rem` }}
            >
              {tieneHijos ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => alternar(nodo.key)}
                  aria-label={colapsado ? t('expandir') : t('contraer')}
                  className={CLASE_ICONO}
                >
                  {colapsado ? (
                    <ChevronRight className="size-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-4" aria-hidden="true" />
                  )}
                </button>
              ) : (
                <span className="size-7 shrink-0" aria-hidden="true" />
              )}
              <span className="w-14 shrink-0 truncate text-xs font-medium tabular-nums text-[var(--color-text-muted)]" title={nodo.codigo}>
                {nodo.codigo}
              </span>
              {editando ? (
                <input
                  autoFocus
                  defaultValue={nodo.nombre}
                  aria-label={t('editar_nombre_aria', { codigo: nodo.codigo })}
                  maxLength={LIMITES_IMPORTACION.nombre + 100}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => confirmarEdicion(nodo.key, e.currentTarget.value.trim())}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      cancelarEdicion.current = true;
                      e.currentTarget.blur();
                    }
                  }}
                  className="h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-brand-gold)] bg-[var(--color-input,var(--color-bg))] px-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]/20"
                />
              ) : (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    setActivaKey(nodo.key);
                    setEditandoKey(nodo.key);
                  }}
                  title={t('editar_nombre')}
                  className={cn(
                    'min-w-0 flex-1 truncate rounded-[var(--radius-sm)] px-2 py-1 text-left text-sm hover:bg-[var(--color-bg-secondary)]',
                    nodo.nombre.trim() === ''
                      ? 'italic text-[var(--color-error)]'
                      : 'text-[var(--color-text-primary)]',
                  )}
                >
                  {nombreMostrado}
                </button>
              )}
              <div className="flex shrink-0 items-center opacity-70 group-hover:opacity-100 group-focus-within:opacity-100" role="group" aria-label={t('acciones_aria')}>
                <button type="button" tabIndex={-1} className={CLASE_ICONO} title={t('subir')} aria-label={t('subir')} disabled={fila.indice === 0} onClick={() => operarYSeguir({ tipo: 'mover', key: nodo.key, delta: -1 }, nodo.key)}>
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
                <button type="button" tabIndex={-1} className={CLASE_ICONO} title={t('bajar')} aria-label={t('bajar')} disabled={fila.indice === fila.hermanos - 1} onClick={() => operarYSeguir({ tipo: 'mover', key: nodo.key, delta: 1 }, nodo.key)}>
                  <ArrowDown className="size-4" aria-hidden="true" />
                </button>
                <button type="button" tabIndex={-1} className={CLASE_ICONO} title={t('sangrar')} aria-label={t('sangrar')} disabled={fila.indice === 0} onClick={() => operarYSeguir({ tipo: 'sangrar', key: nodo.key }, nodo.key)}>
                  <Indent className="size-4" aria-hidden="true" />
                </button>
                <button type="button" tabIndex={-1} className={CLASE_ICONO} title={t('desindentar')} aria-label={t('desindentar')} disabled={nivel === 1} onClick={() => operarYSeguir({ tipo: 'desindentar', key: nodo.key }, nodo.key)}>
                  <Outdent className="size-4" aria-hidden="true" />
                </button>
                <button type="button" tabIndex={-1} className={CLASE_ICONO} title={t('fusionar')} aria-label={t('fusionar')} disabled={fila.indice === 0} onClick={() => operarYSeguir({ tipo: 'fusionar', key: nodo.key }, nodo.key)}>
                  <Merge className="size-4" aria-hidden="true" />
                </button>
                <button type="button" tabIndex={-1} className={CLASE_ICONO} title={t('agregar_hermano')} aria-label={t('agregar_hermano')} onClick={() => agregarItem(nodo.key, false)}>
                  <Plus className="size-4" aria-hidden="true" />
                </button>
                <button type="button" tabIndex={-1} className={CLASE_ICONO} title={t('agregar_hijo')} aria-label={t('agregar_hijo')} onClick={() => agregarItem(nodo.key, true)}>
                  <CornerDownRight className="size-4" aria-hidden="true" />
                </button>
                <button type="button" tabIndex={-1} className={cn(CLASE_ICONO, 'hover:text-[var(--color-error)]')} title={t('eliminar')} aria-label={t('eliminar')} onClick={() => eliminarItem(indice)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
