const ALUMNO_HORARIO_PATH = '/alumno/horario';

function normalizeInternalPath(path: string | null | undefined): string | null {
  if (!path) return null;

  const candidate = path.trim();

  if (!candidate.startsWith('/')) return null;
  if (candidate.startsWith('//')) return null;

  return candidate;
}

export function buildAlumnoHorarioDetailHref(horarioId: string, from?: string | null, notaId?: string | null): string {
  const params = new URLSearchParams({ id: horarioId });
  const safeFrom = normalizeInternalPath(from);

  if (safeFrom) {
    params.set('from', safeFrom);
  }
  if (notaId) {
    params.set('nota_id', notaId);
  }

  return `${ALUMNO_HORARIO_PATH}?${params.toString()}`;
}

export function getAlumnoHorarioBackHref(from?: string | null): string {
  return normalizeInternalPath(from) ?? ALUMNO_HORARIO_PATH;
}

export function buildClaseDetailHref(horarioId: string, rol: 'profesor' | 'admin', from?: string | null, notaId?: string | null): string {
  const basePath = rol === 'admin' ? '/admin/clase' : '/profesor/clase';
  const params = new URLSearchParams({ id: horarioId });
  const safeFrom = normalizeInternalPath(from);

  if (safeFrom) {
    params.set('from', safeFrom);
  }
  if (notaId) {
    params.set('nota_id', notaId);
  }

  return `${basePath}?${params.toString()}`;
}

export function getClaseDetailBackHref(from: string | null | undefined, rol: 'profesor' | 'admin'): string {
  return normalizeInternalPath(from) ?? (rol === 'admin' ? '/admin' : '/profesor');
}
