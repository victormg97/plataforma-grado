export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      carpetas_recursos: {
        Row: {
          id: string
          nombre: string
          parent_id: string | null
          creada_por: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          parent_id?: string | null
          creada_por: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          parent_id?: string | null
          creada_por?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carpetas_recursos_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "carpetas_recursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carpetas_recursos_creada_por_fkey"
            columns: ["creada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueos_horario: {
        Row: {
          id: string
          profesor_id: string
          fecha: string
          hora_inicio: string
          hora_fin: string
          motivo: string | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profesor_id: string
          fecha: string
          hora_inicio: string
          hora_fin: string
          motivo?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profesor_id?: string
          fecha?: string
          hora_inicio?: string
          hora_fin?: string
          motivo?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueos_horario_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alumno_bloqueos: {
        Row: {
          accion: string
          alumno_id: string
          bloqueado_por: string | null
          created_at: string
          id: string
          motivo: string | null
        }
        Insert: {
          accion: string
          alumno_id: string
          bloqueado_por?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
        }
        Update: {
          accion?: string
          alumno_id?: string
          bloqueado_por?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alumno_bloqueos_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumno_bloqueos_bloqueado_por_fkey"
            columns: ["bloqueado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alumnos_extra: {
        Row: {
          alumno_id: string
          año_egreso: string | null
          año_ingreso: string | null
          created_at: string
          fecha_ingreso: string | null
          fecha_prueba: string | null
          ha_dado_examen: boolean
          id: string
          intentos_prueba: number | null
          notas: string | null
          paso_prueba: boolean
          profesor_id: string | null
          universidad: string | null
          updated_at: string
        }
        Insert: {
          alumno_id: string
          año_egreso?: string | null
          año_ingreso?: string | null
          created_at?: string
          fecha_ingreso?: string | null
          fecha_prueba?: string | null
          ha_dado_examen?: boolean
          id?: string
          intentos_prueba?: number | null
          notas?: string | null
          paso_prueba?: boolean
          profesor_id?: string | null
          universidad?: string | null
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          año_egreso?: string | null
          año_ingreso?: string | null
          created_at?: string
          fecha_ingreso?: string | null
          fecha_prueba?: string | null
          ha_dado_examen?: boolean
          id?: string
          intentos_prueba?: number | null
          notas?: string | null
          paso_prueba?: boolean
          profesor_id?: string | null
          universidad?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alumnos_extra_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumnos_extra_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asignaciones_programa: {
        Row: {
          alumno_id: string
          created_at: string
          estado: string
          id: string
          profesor_id: string | null
          programa_id: string
          updated_at: string
        }
        Insert: {
          alumno_id: string
          created_at?: string
          estado?: string
          id?: string
          profesor_id?: string | null
          programa_id: string
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          created_at?: string
          estado?: string
          id?: string
          profesor_id?: string | null
          programa_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignaciones_programa_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_programa_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_programa_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas_clases"
            referencedColumns: ["id"]
          },
        ]
      }
      asistencia: {
        Row: {
          alumno_id: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_asistencia"]
          horario_id: string
          id: string
          nota_alumno: string | null
          nuevo_horario_id: string | null
          updated_at: string
        }
        Insert: {
          alumno_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_asistencia"]
          horario_id: string
          id?: string
          nota_alumno?: string | null
          nuevo_horario_id?: string | null
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_asistencia"]
          horario_id?: string
          id?: string
          nota_alumno?: string | null
          nuevo_horario_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_nuevo_horario_id_fkey"
            columns: ["nuevo_horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
        ]
      }
      clases_programa: {
        Row: {
          created_at: string
          descripcion: string | null
          duracion_min: number | null
          id: string
          nombre: string
          orden: number
          programa_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          duracion_min?: number | null
          id?: string
          nombre: string
          orden?: number
          programa_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          duracion_min?: number | null
          id?: string
          nombre?: string
          orden?: number
          programa_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clases_programa_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas_clases"
            referencedColumns: ["id"]
          },
        ]
      }

      horarios: {
        Row: {
          activo: boolean
          alumno_id: string
          created_at: string
          descripcion: string | null
          es_recurrente: boolean
          fecha: string
          from_programa: boolean | null
          hora_fin: string
          hora_inicio: string
          id: string
          profesor_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          alumno_id: string
          created_at?: string
          descripcion?: string | null
          es_recurrente?: boolean
          fecha: string
          from_programa?: boolean | null
          hora_fin: string
          hora_inicio: string
          id?: string
          profesor_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          alumno_id?: string
          created_at?: string
          descripcion?: string | null
          es_recurrente?: boolean
          fecha?: string
          from_programa?: boolean | null
          hora_fin?: string
          hora_inicio?: string
          id?: string
          profesor_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_programa: {
        Row: {
          asignacion_id: string
          clase_id: string | null
          created_at: string
          horario_id: string
          id: string
        }
        Insert: {
          asignacion_id: string
          clase_id?: string | null
          created_at?: string
          horario_id: string
          id?: string
        }
        Update: {
          asignacion_id?: string
          clase_id?: string | null
          created_at?: string
          horario_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_programa_asignacion_id_fkey"
            columns: ["asignacion_id"]
            isOneToOne: false
            referencedRelation: "asignaciones_programa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_programa_clase_id_fkey"
            columns: ["clase_id"]
            isOneToOne: false
            referencedRelation: "clases_programa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_programa_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          code: string
          created_at: string | null
          email: string | null
          expires_at: string
          id: string
          invitation_type: string | null
          temp_password: string | null
          used: boolean | null
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          email?: string | null
          expires_at: string
          id?: string
          invitation_type?: string | null
          temp_password?: string | null
          used?: boolean | null
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          invitation_type?: string | null
          temp_password?: string | null
          used?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      notas_alumno: {
        Row: {
          alumno_id: string
          autor_id: string
          contenido: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          alumno_id: string
          autor_id: string
          contenido: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          alumno_id?: string
          autor_id?: string
          contenido?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_alumno_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_alumno_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_clase: {
        Row: {
          autor_id: string
          contenido: string
          created_at: string
          horario_id: string
          id: string
          updated_at: string
        }
        Insert: {
          autor_id: string
          contenido: string
          created_at?: string
          horario_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          autor_id?: string
          contenido?: string
          created_at?: string
          horario_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_clase_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_clase_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          alumno_id: string | null
          created_at: string
          destinatario_id: string
          horario_id: string | null
          id: string
          leida: boolean
          mensaje: string
          programa_id: string | null
          solicitud_id: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Insert: {
          alumno_id?: string | null
          created_at?: string
          destinatario_id: string
          horario_id?: string | null
          id?: string
          leida?: boolean
          mensaje: string
          programa_id?: string | null
          solicitud_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Update: {
          alumno_id?: string | null
          created_at?: string
          destinatario_id?: string
          horario_id?: string | null
          id?: string
          leida?: boolean
          mensaje?: string
          programa_id?: string | null
          solicitud_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas_clases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_cambio_horario"
            referencedColumns: ["id"]
          },
        ]
      }

      pagos: {
        Row: {
          alumno_id: string
          anio: number
          created_at: string
          estado: string
          fecha_pago: string
          id: string
          mes: number
          monto_pagado: number | null
          notas: string | null
          updated_at: string
        }
        Insert: {
          alumno_id: string
          anio: number
          created_at?: string
          estado?: string
          fecha_pago?: string
          id?: string
          mes: number
          monto_pagado?: number | null
          notas?: string | null
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          anio?: number
          created_at?: string
          estado?: string
          fecha_pago?: string
          id?: string
          mes?: number
          monto_pagado?: number | null
          notas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          apellido: string
          apellido_materno: string | null
          avatar_url: string | null
          cancellation_deadline_hours: number
          created_at: string
          duracion_clase_default_min: number
          email: string
          id: string
          idioma: string | null
          nombre: string
          puede_crear_alumno: boolean | null
          rol: Database["public"]["Enums"]["user_rol"]
          telefono: string | null
          tema: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          apellido: string
          apellido_materno?: string | null
          avatar_url?: string | null
          cancellation_deadline_hours?: number
          created_at?: string
          duracion_clase_default_min?: number
          email: string
          id: string
          idioma?: string | null
          nombre: string
          puede_crear_alumno?: boolean | null
          rol?: Database["public"]["Enums"]["user_rol"]
          telefono?: string | null
          tema?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          apellido?: string
          apellido_materno?: string | null
          avatar_url?: string | null
          cancellation_deadline_hours?: number
          created_at?: string
          duracion_clase_default_min?: number
          email?: string
          id?: string
          idioma?: string | null
          nombre?: string
          puede_crear_alumno?: boolean | null
          rol?: Database["public"]["Enums"]["user_rol"]
          telefono?: string | null
          tema?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programa_profesores: {
        Row: {
          created_at: string
          id: string
          profesor_id: string
          programa_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profesor_id: string
          programa_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profesor_id?: string
          programa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programa_profesores_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_profesores_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas_clases"
            referencedColumns: ["id"]
          },
        ]
      }
      programas_clases: {
        Row: {
          created_at: string
          created_by: string
          descripcion: string | null
          estado: string
          id: string
          nombre: string
          profesor_id: string | null
          updated_at: string
          visibilidad: string
        }
        Insert: {
          created_at?: string
          created_by: string
          descripcion?: string | null
          estado?: string
          id?: string
          nombre: string
          profesor_id?: string | null
          updated_at?: string
          visibilidad?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          descripcion?: string | null
          estado?: string
          id?: string
          nombre?: string
          profesor_id?: string | null
          updated_at?: string
          visibilidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "programas_clases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programas_clases_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pruebas: {
        Row: {
          alumno_id: string
          clase_id: string | null
          created_at: string
          estado: string
          fecha: string
          horario_id: string | null
          id: string
          nombre: string
          nota: number | null
          observaciones: string | null
          profesor_id: string | null
          updated_at: string
        }
        Insert: {
          alumno_id: string
          clase_id?: string | null
          created_at?: string
          estado?: string
          fecha: string
          horario_id?: string | null
          id?: string
          nombre: string
          nota?: number | null
          observaciones?: string | null
          profesor_id?: string | null
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          clase_id?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          horario_id?: string | null
          id?: string
          nombre?: string
          nota?: number | null
          observaciones?: string | null
          profesor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pruebas_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pruebas_clase_id_fkey"
            columns: ["clase_id"]
            isOneToOne: false
            referencedRelation: "clases_programa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pruebas_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pruebas_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recursos_acceso: {
        Row: {
          alumno_id: string
          created_at: string
          id: string
          recurso_id: string
        }
        Insert: {
          alumno_id: string
          created_at?: string
          id?: string
          recurso_id: string
        }
        Update: {
          alumno_id?: string
          created_at?: string
          id?: string
          recurso_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recursos_acceso_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recursos_acceso_recurso_id_fkey"
            columns: ["recurso_id"]
            isOneToOne: false
            referencedRelation: "recursos_compartidos"
            referencedColumns: ["id"]
          },
        ]
      }
      recursos_compartidos: {
        Row: {
          bloquear_descarga: boolean
          carpeta_id: string | null
          created_at: string
          descripcion: string | null
          id: string
          para_todos: boolean
          storage_path: string | null
          subido_por: string
          tipo: string
          titulo: string
          updated_at: string
          url: string | null
        }
        Insert: {
          bloquear_descarga?: boolean
          carpeta_id?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          para_todos?: boolean
          storage_path?: string | null
          subido_por: string
          tipo: string
          titulo: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          bloquear_descarga?: boolean
          carpeta_id?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          para_todos?: boolean
          storage_path?: string | null
          subido_por?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recursos_compartidos_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recursos_compartidos_carpeta_id_fkey"
            columns: ["carpeta_id"]
            isOneToOne: false
            referencedRelation: "carpetas_recursos"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_cambio_horario: {
        Row: {
          alumno_id: string
          created_at: string
          estado: string
          fecha_propuesta: string
          hora_fin_propuesta: string
          hora_inicio_propuesta: string
          horario_original_id: string
          id: string
          motivo_rechazo: string | null
          nota_alumno: string | null
          nuevo_horario_id: string | null
          profesor_id: string
          updated_at: string
        }
        Insert: {
          alumno_id: string
          created_at?: string
          estado?: string
          fecha_propuesta: string
          hora_fin_propuesta: string
          hora_inicio_propuesta: string
          horario_original_id: string
          id?: string
          motivo_rechazo?: string | null
          nota_alumno?: string | null
          nuevo_horario_id?: string | null
          profesor_id: string
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          created_at?: string
          estado?: string
          fecha_propuesta?: string
          hora_fin_propuesta?: string
          hora_inicio_propuesta?: string
          horario_original_id?: string
          id?: string
          motivo_rechazo?: string | null
          nota_alumno?: string | null
          nuevo_horario_id?: string | null
          profesor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_cambio_horario_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cambio_horario_horario_original_id_fkey"
            columns: ["horario_original_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cambio_horario_nuevo_horario_id_fkey"
            columns: ["nuevo_horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cambio_horario_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_pagar_mes_columna: {
        Args: {
          p_anio: number
          p_estado: string
          p_mes: number
          p_monto?: number
        }
        Returns: undefined
      }
      alumno_tiene_asignacion_activa: {
        Args: { p_programa_id: string }
        Returns: boolean
      }
      delete_programa_asignado_notifications: {
        Args: { p_alumno_ids: string[]; p_programa_id: string }
        Returns: undefined
      }
      get_admin_init_data: { Args: never; Returns: Json }
      get_admin_stats: { Args: never; Returns: Json }
      get_alumno_dashboard: { Args: { p_alumno_id: string }; Returns: Json }
      get_alumno_ficha:
        | { Args: { p_alumno_id: string; p_limit?: number }; Returns: Json }
        | {
            Args: { p_alumno_id: string; p_autor_id?: string; p_limit?: number }
            Returns: Json
          }
      get_is_prueba_locked: { Args: { p_prueba_id: string }; Returns: boolean }
      get_notas_clase: { Args: { p_horario_id: string }; Returns: Json }
      get_alumnos_admin: {
        Args: { p_estado?: string | null; p_profesor_id?: string | null; p_q?: string | null }
        Returns: {
          activo: boolean
          año_ingreso: string | null
          apellido: string
          apellido_materno: string | null
          avatar_url: string | null
          email: string
          estado: string
          fecha_ingreso: string | null
          fecha_prueba: string | null
          id: string
          nombre: string
          notas: string | null
          paso_prueba: boolean
          profesor_apellido: string | null
          profesor_id: string | null
          profesor_nombre: string | null
          telefono: string | null
          universidad: string | null
        }[]
      }
      get_alumnos_profesor: {
        Args: { p_profesor_id: string; p_scope?: string | null }
        Returns: {
          activo: boolean
          alumno_id: string
          año_ingreso: string | null
          apellido: string
          apellido_materno: string | null
          avatar_url: string | null
          email: string
          estado_cuenta: string
          fecha_prueba: string | null
          ha_dado_examen: boolean
          id: string
          intentos_prueba: number | null
          nombre: string
          notas: string | null
          paso_prueba: boolean
          profesor_id: string | null
          rol: string
          telefono: string | null
          universidad: string | null
        }[]
      }
      get_pagos_mes: {
        Args: { p_año: number; p_mes: number }
        Returns: {
          activo: boolean
          alumno_id: string
          apellido: string
          avatar_url: string | null
          nombre: string
          pago_estado: string | null
          pago_fecha: string | null
          pago_id: string | null
          pago_monto: number | null
          paso_prueba: boolean
          profesor_apellido: string | null
          profesor_id: string | null
          profesor_nombre: string | null
        }[]
      }
      get_profesores_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          activo: boolean
          alumnos_count: number
          apellido: string
          apellido_materno: string | null
          avatar_url: string | null
          email: string
          estado_cuenta: string
          id: string
          nombre: string
          puede_crear_alumno: boolean | null
          rol: string
          telefono: string | null
        }[]
      }
      get_profesor_dashboard: { Args: { p_profesor_id: string }; Returns: Json }
      get_recursos_for_user: { Args: never; Returns: Json }
      get_server_time: { Args: never; Returns: string }
      get_user_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["user_rol"]
      }
      is_own_recurso: { Args: { p_recurso_id: string }; Returns: boolean }
    }
    Enums: {
      estado_asistencia:
        | "pendiente"
        | "confirmado"
        | "cancelado"
        | "cambiado"
        | "no_asistio"
      tipo_notificacion:
        | "confirmacion"
        | "cancelacion"
        | "cambio_horario"
        | "nueva_clase"
        | "clase_modificada"
        | "clase_cancelada"
        | "programa_asignado"
        | "solicitud_cambio_horario"
        | "cambio_horario_aceptado"
        | "cambio_horario_rechazado"
      user_rol: "admin" | "profesor" | "alumno"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_asistencia: [
        "pendiente",
        "confirmado",
        "cancelado",
        "cambiado",
        "no_asistio",
      ],
      tipo_notificacion: [
        "confirmacion",
        "cancelacion",
        "cambio_horario",
        "nueva_clase",
        "clase_modificada",
        "clase_cancelada",
        "programa_asignado",
        "solicitud_cambio_horario",
        "cambio_horario_aceptado",
        "cambio_horario_rechazado",
      ],
      user_rol: ["admin", "profesor", "alumno"],
    },
  },
} as const


// ─── Custom type aliases ──────────────────────────────────────────────────────

export type TipoNotificacion = Database['public']['Enums']['tipo_notificacion'];
export type UserRol = Database['public']['Enums']['user_rol'];
export type EstadoAsistencia = Database['public']['Enums']['estado_asistencia'];

export type Profile = Tables<'profiles'>;
export type AlumnoExtra = Tables<'alumnos_extra'>;
export type Horario = Tables<'horarios'>;
export type Prueba = Tables<'pruebas'>;
export type ProgramaClase = Tables<'programas_clases'>;

export type EstadoPrograma = 'activo' | 'eliminado';
export type EstadoPrueba = 'pendiente' | 'calificada' | 'en_curso';

export type ClaseItem = {
  id: string;
  tempId?: string;
  nombre: string;
  tipo: 'materia' | 'prueba';
  orden: number;
  duracion_min?: number | null;
  descripcion?: string | null;
};

export type AsignacionConAlumno = {
  id: string;
  alumno_id: string;
  programa_id: string;
  profesor_id: string | null;
  estado: string;
  created_at: string;
  updated_at: string;
  alumno?: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    avatar_url?: string | null;
  } | null;
};

export type ProgramaClaseConConteo = ProgramaClase & {
  total_clases: number;
  total_pruebas: number;
  total_asignados: number;
  visibilidad: string;
  profesores_asignados: Array<{ id: string; nombre: string; apellido: string; avatar_url?: string | null }>;
  creado_por?: { id: string; nombre: string; apellido: string } | null;
  profesor?: { id: string; nombre: string; apellido: string; avatar_url?: string | null } | null;
};

export type NotaClaseConAutor = {
  id: string;
  horario_id: string;
  contenido: string;
  autor_id: string;
  created_at: string;
  updated_at: string;
  autor: {
    id: string;
    nombre: string;
    apellido: string;
    avatar_url: string | null;
    rol: UserRol;
  };
};
