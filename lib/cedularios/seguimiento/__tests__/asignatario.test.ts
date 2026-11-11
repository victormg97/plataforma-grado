import { describe, expect, it } from 'vitest';
import {
  accionCedularioPropio,
  esStaffAsignatario,
  normalizarAsignatarioRol,
} from '../asignatario';

describe('esStaffAsignatario', () => {
  it('is true for profesor and admin', () => {
    expect(esStaffAsignatario('profesor')).toBe(true);
    expect(esStaffAsignatario('admin')).toBe(true);
  });

  it('is false for alumno and unknown values', () => {
    expect(esStaffAsignatario('alumno')).toBe(false);
    expect(esStaffAsignatario('lector')).toBe(false);
    expect(esStaffAsignatario('')).toBe(false);
    expect(esStaffAsignatario(null)).toBe(false);
    expect(esStaffAsignatario(undefined)).toBe(false);
  });
});

describe('normalizarAsignatarioRol', () => {
  it('falls back to alumno', () => {
    expect(normalizarAsignatarioRol('x')).toBe('alumno');
    expect(normalizarAsignatarioRol(undefined)).toBe('alumno');
    expect(normalizarAsignatarioRol('admin')).toBe('admin');
  });
});

describe('accionCedularioPropio', () => {
  it('asks to assign when there are no active assignments', () => {
    expect(accionCedularioPropio(0)).toBe('asignar');
  });

  it('asks to review with one or many', () => {
    expect(accionCedularioPropio(1)).toBe('revisar');
    expect(accionCedularioPropio(7)).toBe('revisar');
  });

  it('is safe with negative, NaN and infinite values', () => {
    expect(accionCedularioPropio(-3)).toBe('asignar');
    expect(accionCedularioPropio(Number.NaN)).toBe('asignar');
    expect(accionCedularioPropio(Number.POSITIVE_INFINITY)).toBe('asignar');
  });
});
