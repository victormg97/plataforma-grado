import { describe, expect, it } from 'vitest';
import { accionesHoverCard } from '../permisos';

describe('accionesHoverCard', () => {
  it('ofrece asignar con 0, 1 o varias asignaciones activas', () => {
    for (const totalActivas of [0, 1, 2, 5]) {
      const acciones = accionesHoverCard({ totalActivas, puedeEditar: true, alumnoActivo: true });
      expect(acciones.asignar).toBe(true);
    }
  });

  it('no ofrece asignar a un alumno inactivo ni sin permiso de edicion', () => {
    expect(accionesHoverCard({ totalActivas: 1, puedeEditar: true, alumnoActivo: false }).asignar).toBe(false);
    expect(accionesHoverCard({ totalActivas: 0, puedeEditar: false, alumnoActivo: true }).asignar).toBe(false);
  });

  it('mantiene la accion de revisar segun el total', () => {
    const base = { puedeEditar: true, alumnoActivo: true };
    expect(accionesHoverCard({ ...base, totalActivas: 0 }).revisar).toBe('ninguno');
    expect(accionesHoverCard({ ...base, totalActivas: 1 }).revisar).toBe('directo');
    expect(accionesHoverCard({ ...base, totalActivas: 2 }).revisar).toBe('menu');
  });

  it('el mensaje de sin cedularios solo aparece sin asignaciones y sin permiso', () => {
    expect(accionesHoverCard({ totalActivas: 0, puedeEditar: false, alumnoActivo: true }).mensajeSinCedularios).toBe(true);
    expect(accionesHoverCard({ totalActivas: 2, puedeEditar: false, alumnoActivo: true }).mensajeSinCedularios).toBe(false);
  });
});
