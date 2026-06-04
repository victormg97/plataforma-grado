// Tipos compartidos para la funcionalidad de enlaces de invitación.

export type TipoEnlace = 'profesor' | 'alumno' | 'lector';

/** Estados conocidos. El estado se modela como string para ser extensible. */
export type EstadoEnlaceConocido = 'activo' | 'usado' | 'deshabilitado';

export interface PersonaResumen {
  id: string;
  nombre: string;
  apellido: string;
  apellido_materno?: string | null;
  email?: string | null;
}

/**
 * Fila de enlace tal como la consume la vista de gestión. Incluye nombres
 * resueltos (creador, profesor asignado, usuario creado) para el listado.
 */
export interface EnlaceListItem {
  id: string;
  codigo: string;
  tipo: TipoEnlace | string;
  estado: string;
  created_by: string | null;
  created_at: string;
  /** Última modificación — cuando estado='usado', refleja la fecha de uso. */
  updated_at: string;
  creador: PersonaResumen | null;
  profesor_asignado: string | null;
  profesor: PersonaResumen | null;
  usuario_creado: string | null;
  usuario: (PersonaResumen & { activo: boolean }) | null;
}

/** Rol del usuario autenticado. */
export type Rol = 'admin' | 'profesor' | 'alumno' | 'lector';

/** Actor que solicita crear un enlace. */
export interface Actor {
  id: string;
  rol: Rol;
  puede_crear_alumno: boolean;
}

/** Solicitud de creación de un enlace. */
export interface SolicitudCreacion {
  tipo: TipoEnlace | string;
  profesor_asignado?: string | null;
}

/** Resultado de autorizar la creación de un enlace. */
export type ResultadoAutorizacion =
  | {
      ok: true;
      enlace: {
        tipo: TipoEnlace;
        created_by: string;
        profesor_asignado: string | null;
        estado: 'activo';
      };
    }
  | { ok: false; motivo: 'rol_no_autorizado' | 'tipo_no_permitido' | 'tipo_invalido' };
