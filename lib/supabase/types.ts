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
      // ─── Agenda tables ─────────────────────────────────────────────────
      agenda_eventos: {
        Row: {
          activo: boolean
          alcance: Database["public"]["Enums"]["agenda_alcance"]
          categoria: Database["public"]["Enums"]["agenda_categoria"]
          creador_id: string
          created_at: string
          descripcion: string | null
          dia_completo: boolean
          enlace_conexion: string | null
          fecha: string
          hora_fin: string
          hora_inicio: string
          id: string
          lugar: string | null
          nota: string | null
          titulo: string
          updated_at: string
          visibilidad: Database["public"]["Enums"]["agenda_visibilidad"]
        }
        Insert: {
          activo?: boolean
          alcance: Database["public"]["Enums"]["agenda_alcance"]
          categoria?: Database["public"]["Enums"]["agenda_categoria"]
          creador_id: string
          created_at?: string
          descripcion?: string | null
          dia_completo?: boolean
          enlace_conexion?: string | null
          fecha: string
          hora_fin: string
          hora_inicio: string
          id?: string
          lugar?: string | null
          nota?: string | null
          titulo: string
          updated_at?: string
          visibilidad?: Database["public"]["Enums"]["agenda_visibilidad"]
        }
        Update: {
          activo?: boolean
          alcance?: Database["public"]["Enums"]["agenda_alcance"]
          categoria?: Database["public"]["Enums"]["agenda_categoria"]
          creador_id?: string
          created_at?: string
          descripcion?: string | null
          dia_completo?: boolean
          enlace_conexion?: string | null
          fecha?: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
          lugar?: string | null
          nota?: string | null
          titulo?: string
          updated_at?: string
          visibilidad?: Database["public"]["Enums"]["agenda_visibilidad"]
        }
        Relationships: [
          {
            foreignKeyName: "agenda_eventos_creador_id_fkey"
            columns: ["creador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_evento_destinatarios: {
        Row: {
          alumno_id: string
          created_at: string
          evento_id: string
          id: string
        }
        Insert: {
          alumno_id: string
          created_at?: string
          evento_id: string
          id?: string
        }
        Update: {
          alumno_id?: string
          created_at?: string
          evento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_evento_destinatarios_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_evento_destinatarios_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "agenda_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_evento_ocultaciones: {
        Row: {
          alumno_id: string
          created_at: string
          evento_id: string
          id: string
        }
        Insert: {
          alumno_id: string
          created_at?: string
          evento_id: string
          id?: string
        }
        Update: {
          alumno_id?: string
          created_at?: string
          evento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_evento_ocultaciones_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_evento_ocultaciones_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "agenda_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
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

      landing_sobre_nosotras_config: {
        Row: {
          id: string
          tenant_slug: string
          persona1_nombre: string
          persona1_prefijo: string
          persona1_image_path: string | null
          persona2_nombre: string
          persona2_prefijo: string
          persona2_image_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_slug: string
          persona1_nombre?: string
          persona1_prefijo?: string
          persona1_image_path?: string | null
          persona2_nombre?: string
          persona2_prefijo?: string
          persona2_image_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_slug?: string
          persona1_nombre?: string
          persona1_prefijo?: string
          persona1_image_path?: string | null
          persona2_nombre?: string
          persona2_prefijo?: string
          persona2_image_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      landing_planes_config: {
        Row: {
          id: string
          tenant_slug: string
          oferta_activa: boolean
          oferta_texto: string | null
          oferta_mes_automatico: boolean
          plan1_nombre: string
          plan1_detalle: string
          plan1_precio: number
          plan1_precio_antes: number | null
          plan2_nombre: string
          plan2_detalle: string
          plan2_precio: number
          plan2_precio_antes: number | null
          tutoria1_nombre: string
          tutoria1_detalle: string
          tutoria1_precio: number
          tutoria2_nombre: string
          tutoria2_detalle: string
          tutoria2_precio: number
          lector_precio: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_slug: string
          oferta_activa?: boolean
          oferta_texto?: string | null
          oferta_mes_automatico?: boolean
          plan1_nombre?: string
          plan1_detalle?: string
          plan1_precio?: number
          plan1_precio_antes?: number | null
          plan2_nombre?: string
          plan2_detalle?: string
          plan2_precio?: number
          plan2_precio_antes?: number | null
          tutoria1_nombre?: string
          tutoria1_detalle?: string
          tutoria1_precio?: number
          tutoria2_nombre?: string
          tutoria2_detalle?: string
          tutoria2_precio?: number
          lector_precio?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_slug?: string
          oferta_activa?: boolean
          oferta_texto?: string | null
          oferta_mes_automatico?: boolean
          plan1_nombre?: string
          plan1_detalle?: string
          plan1_precio?: number
          plan1_precio_antes?: number | null
          plan2_nombre?: string
          plan2_detalle?: string
          plan2_precio?: number
          plan2_precio_antes?: number | null
          tutoria1_nombre?: string
          tutoria1_detalle?: string
          tutoria1_precio?: number
          tutoria2_nombre?: string
          tutoria2_detalle?: string
          tutoria2_precio?: number
          lector_precio?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      horarios: {
        Row: {
          activo: boolean
          alumno_id: string
          created_at: string
          descripcion: string | null
          enlace_conexion: string | null
          es_recurrente: boolean
          fecha: string
          from_programa: boolean | null
          hora_fin: string
          hora_inicio: string
          id: string
          profesor_id: string
          tipo_clase: Database["public"]["Enums"]["tipo_clase"]
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          alumno_id: string
          created_at?: string
          descripcion?: string | null
          enlace_conexion?: string | null
          es_recurrente?: boolean
          fecha: string
          from_programa?: boolean | null
          hora_fin: string
          hora_inicio: string
          id?: string
          profesor_id: string
          tipo_clase?: Database["public"]["Enums"]["tipo_clase"]
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          alumno_id?: string
          created_at?: string
          descripcion?: string | null
          enlace_conexion?: string | null
          es_recurrente?: boolean
          fecha?: string
          from_programa?: boolean | null
          hora_fin?: string
          hora_inicio?: string
          id?: string
          profesor_id?: string
          tipo_clase?: Database["public"]["Enums"]["tipo_clase"]
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
      simulacion_comision: {
        Row: {
          id: string
          horario_id: string
          profesor_id: string
          created_at: string
        }
        Insert: {
          id?: string
          horario_id: string
          profesor_id: string
          created_at?: string
        }
        Update: {
          id?: string
          horario_id?: string
          profesor_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulacion_comision_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacion_comision_profesor_id_fkey"
            columns: ["profesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacion_evaluaciones: {
        Row: {
          id: string
          horario_id: string
          profesor_id: string
          nota: number | null
          feedback: string | null
          estado: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          horario_id: string
          profesor_id: string
          nota?: number | null
          feedback?: string | null
          estado?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          horario_id?: string
          profesor_id?: string
          nota?: number | null
          feedback?: string | null
          estado?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulacion_evaluaciones_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacion_evaluaciones_profesor_id_fkey"
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
      enlaces_invitacion: {
        Row: {
          id: string
          tenant: string
          codigo: string
          tipo: string
          estado: string
          created_by: string | null
          profesor_asignado: string | null
          usuario_creado: string | null
          eliminado: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          codigo: string
          tipo: string
          estado?: string
          created_by?: string | null
          profesor_asignado?: string | null
          usuario_creado?: string | null
          eliminado?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          codigo?: string
          tipo?: string
          estado?: string
          created_by?: string | null
          profesor_asignado?: string | null
          usuario_creado?: string | null
          eliminado?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enlaces_invitacion_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enlaces_invitacion_profesor_asignado_fkey"
            columns: ["profesor_asignado"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enlaces_invitacion_usuario_creado_fkey"
            columns: ["usuario_creado"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          agenda_evento_id: string | null
          alumno_id: string | null
          created_at: string
          destinatario_id: string
          horario_id: string | null
          id: string
          leida: boolean
          mensaje: string
          nota_clase_id: string | null
          programa_id: string | null
          solicitud_id: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Insert: {
          agenda_evento_id?: string | null
          alumno_id?: string | null
          created_at?: string
          destinatario_id: string
          horario_id?: string | null
          id?: string
          leida?: boolean
          mensaje: string
          nota_clase_id?: string | null
          programa_id?: string | null
          solicitud_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Update: {
          agenda_evento_id?: string | null
          alumno_id?: string | null
          created_at?: string
          destinatario_id?: string
          horario_id?: string | null
          id?: string
          leida?: boolean
          mensaje?: string
          nota_clase_id?: string | null
          programa_id?: string | null
          solicitud_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_agenda_evento_id_fkey"
            columns: ["agenda_evento_id"]
            isOneToOne: false
            referencedRelation: "agenda_eventos"
            referencedColumns: ["id"]
          },
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

      notificaciones_vistas_admin: {
        Row: {
          notificacion_id: string
          admin_id: string
          created_at: string
        }
        Insert: {
          notificacion_id: string
          admin_id: string
          created_at?: string
        }
        Update: {
          notificacion_id?: string
          admin_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_vistas_admin_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: false
            referencedRelation: "notificaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_vistas_admin_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones_descartadas_admin: {
        Row: {
          notificacion_id: string
          admin_id: string
          created_at: string
        }
        Insert: {
          notificacion_id: string
          admin_id: string
          created_at?: string
        }
        Update: {
          notificacion_id?: string
          admin_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_descartadas_admin_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: false
            referencedRelation: "notificaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_descartadas_admin_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          color_calendario: string | null
          created_at: string
          duracion_clase_default_min: number
          email: string
          enviar_correo_al_asignar: boolean
          id: string
          idioma: string | null
          nombre: string
          puede_crear_alumno: boolean | null
          recordatorio_cooldown_minutos: number
          rol: Database["public"]["Enums"]["user_rol"]
          telefono: string | null
          tema: string | null
          ui_preferences: Json
          updated_at: string
        }
        Insert: {
          activo?: boolean
          apellido: string
          apellido_materno?: string | null
          avatar_url?: string | null
          cancellation_deadline_hours?: number
          color_calendario?: string | null
          created_at?: string
          duracion_clase_default_min?: number
          email: string
          enviar_correo_al_asignar?: boolean
          id: string
          idioma?: string | null
          nombre: string
          puede_crear_alumno?: boolean | null
          recordatorio_cooldown_minutos?: number
          rol?: Database["public"]["Enums"]["user_rol"]
          telefono?: string | null
          tema?: string | null
          ui_preferences?: Json
          updated_at?: string
        }
        Update: {
          activo?: boolean
          apellido?: string
          apellido_materno?: string | null
          avatar_url?: string | null
          cancellation_deadline_hours?: number
          color_calendario?: string | null
          created_at?: string
          duracion_clase_default_min?: number
          email?: string
          enviar_correo_al_asignar?: boolean
          id?: string
          idioma?: string | null
          nombre?: string
          puede_crear_alumno?: boolean | null
          recordatorio_cooldown_minutos?: number
          rol?: Database["public"]["Enums"]["user_rol"]
          telefono?: string | null
          tema?: string | null
          ui_preferences?: Json
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
          para_todos_app: boolean
          storage_path: string | null
          subido_por: string
          thumbnail_path: string | null
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
          para_todos_app?: boolean
          storage_path?: string | null
          subido_por: string
          thumbnail_path?: string | null
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
          para_todos_app?: boolean
          storage_path?: string | null
          subido_por?: string
          thumbnail_path?: string | null
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
      email_plantillas: {
        Row: {
          id: string
          user_id: string
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
          asunto: string
          cuerpo_html: string
          max_caracteres_nota: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
          asunto: string
          cuerpo_html: string
          max_caracteres_nota?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tipo?: Database["public"]["Enums"]["tipo_notificacion"]
          asunto?: string
          cuerpo_html?: string
          max_caracteres_nota?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_plantillas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_envios: {
        Row: {
          id: string
          originador_id: string
          destinatario_id: string
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
          resultado: string
          motivo: string | null
          horario_id: string | null
          evento_id: string
          created_at: string
        }
        Insert: {
          id?: string
          originador_id: string
          destinatario_id: string
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
          resultado: string
          motivo?: string | null
          horario_id?: string | null
          evento_id: string
          created_at?: string
        }
        Update: {
          id?: string
          originador_id?: string
          destinatario_id?: string
          tipo?: Database["public"]["Enums"]["tipo_notificacion"]
          resultado?: string
          motivo?: string | null
          horario_id?: string | null
          evento_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_envios_originador_id_fkey"
            columns: ["originador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_envios_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_envios_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
        ]
      }
      email_recordatorios: {
        Row: {
          id: string
          horario_id: string
          alumno_id: string
          enviado_por: string
          created_at: string
        }
        Insert: {
          id?: string
          horario_id: string
          alumno_id: string
          enviado_por: string
          created_at?: string
        }
        Update: {
          id?: string
          horario_id?: string
          alumno_id?: string
          enviado_por?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_recordatorios_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "horarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_recordatorios_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_recordatorios_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_contact_info: {
        Row: {
          id: string
          tenant_slug: string
          type: 'whatsapp' | 'email' | 'social'
          label: string
          value: string
          url: string
          icon_key: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_slug: string
          type: 'whatsapp' | 'email' | 'social'
          label: string
          value: string
          url: string
          icon_key?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_slug?: string
          type?: 'whatsapp' | 'email' | 'social'
          label?: string
          value?: string
          url?: string
          icon_key?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_recursos_preferences: {
        Row: {
          user_id: string
          sort_by: 'created_at_desc' | 'created_at_asc' | 'nombre_asc' | 'nombre_desc' | 'tipo_asc'
          updated_at: string
        }
        Insert: {
          user_id: string
          sort_by?: 'created_at_desc' | 'created_at_asc' | 'nombre_asc' | 'nombre_desc' | 'tipo_asc'
          updated_at?: string
        }
        Update: {
          user_id?: string
          sort_by?: 'created_at_desc' | 'created_at_asc' | 'nombre_asc' | 'nombre_desc' | 'tipo_asc'
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_recursos_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      referral_settings: {
        Row: {
          id: string
          tenant: string
          platform_enabled: boolean
          tenant_enabled: boolean
          display_name: string
          icon: string
          reader_role_enabled: boolean
          discount_codes_module_enabled: boolean
          discount_codes_display_name: string
          show_rewards_to_user: boolean
          show_referral_count_to_user: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          platform_enabled?: boolean
          tenant_enabled?: boolean
          display_name?: string
          icon?: string
          reader_role_enabled?: boolean
          discount_codes_module_enabled?: boolean
          discount_codes_display_name?: string
          show_rewards_to_user?: boolean
          show_referral_count_to_user?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          platform_enabled?: boolean
          tenant_enabled?: boolean
          display_name?: string
          icon?: string
          reader_role_enabled?: boolean
          discount_codes_module_enabled?: boolean
          discount_codes_display_name?: string
          show_rewards_to_user?: boolean
          show_referral_count_to_user?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_reward_rules: {
        Row: {
          id: string
          tenant: string
          rule_type: 'referred_new' | 'referrer' | 'volume_goal'
          reward_type: 'fixed_amount' | 'percentage' | 'free_session' | 'custom'
          reward_value: number
          duration_cycles: number
          pack_size: number
          max_discount_per_cycle: number
          volume_target: number | null
          volume_period: 'weekly' | 'monthly' | 'quarterly' | null
          volume_reward_description: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          rule_type: 'referred_new' | 'referrer' | 'volume_goal'
          reward_type: 'fixed_amount' | 'percentage' | 'free_session' | 'custom'
          reward_value?: number
          duration_cycles?: number
          pack_size?: number
          max_discount_per_cycle?: number
          volume_target?: number | null
          volume_period?: 'weekly' | 'monthly' | 'quarterly' | null
          volume_reward_description?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          rule_type?: 'referred_new' | 'referrer' | 'volume_goal'
          reward_type?: 'fixed_amount' | 'percentage' | 'free_session' | 'custom'
          reward_value?: number
          duration_cycles?: number
          pack_size?: number
          max_discount_per_cycle?: number
          volume_target?: number | null
          volume_period?: 'weekly' | 'monthly' | 'quarterly' | null
          volume_reward_description?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_referral_codes: {
        Row: {
          id: string
          user_id: string
          tenant: string
          code: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tenant: string
          code: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tenant?: string
          code?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          id: string
          tenant: string
          code: string
          start_date: string | null
          end_date: string | null
          is_active: boolean
          manual_override: boolean | null
          reward_rule_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          code: string
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          manual_override?: boolean | null
          reward_rule_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          code?: string
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          manual_override?: boolean | null
          reward_rule_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_reward_rule_id_fkey"
            columns: ["reward_rule_id"]
            isOneToOne: false
            referencedRelation: "referral_reward_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_usages: {
        Row: {
          id: string
          tenant: string
          referred_user_id: string
          user_referral_code_id: string | null
          discount_code_id: string | null
          used_at: string
          rewards_applied: import('./types').Json
        }
        Insert: {
          id?: string
          tenant: string
          referred_user_id: string
          user_referral_code_id?: string | null
          discount_code_id?: string | null
          used_at?: string
          rewards_applied?: import('./types').Json
        }
        Update: {
          id?: string
          tenant?: string
          referred_user_id?: string
          user_referral_code_id?: string | null
          discount_code_id?: string | null
          used_at?: string
          rewards_applied?: import('./types').Json
        }
        Relationships: [
          {
            foreignKeyName: "referral_usages_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_usages_user_referral_code_id_fkey"
            columns: ["user_referral_code_id"]
            isOneToOne: false
            referencedRelation: "user_referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_usages_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      // ─── Question Bank tables ──────────────────────────────────────────
      question_bank_settings: {
        Row: {
          id: string
          tenant: string
          question_bank_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          question_bank_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          question_bank_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      qb_categories: {
        Row: {
          id: string
          tenant: string
          name: string
          keywords: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          name: string
          keywords?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          name?: string
          keywords?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      qb_subjects: {
        Row: {
          id: string
          tenant: string
          name: string
          keywords: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          name: string
          keywords?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          name?: string
          keywords?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      qb_tags: {
        Row: {
          id: string
          tenant: string
          name: string
          keywords: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          name: string
          keywords?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          name?: string
          keywords?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      qb_questions: {
        Row: {
          id: string
          tenant: string
          type: string
          content: string
          options: import('./types').Json
          explanation: string | null
          category_id: string | null
          subject_id: string | null
          difficulty: string | null
          status: string
          import_batch_id: string | null
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
          search_vector: unknown
        }
        Insert: {
          id?: string
          tenant: string
          type: string
          content: string
          options?: import('./types').Json
          explanation?: string | null
          subject_id?: string | null
          category_id?: string | null
          difficulty?: string | null
          status?: string
          import_batch_id?: string | null
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          type?: string
          content?: string
          options?: import('./types').Json
          explanation?: string | null
          subject_id?: string | null
          category_id?: string | null
          difficulty?: string | null
          status?: string
          import_batch_id?: string | null
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qb_questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "qb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qb_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qb_questions_import_batch_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "qb_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      qb_question_tags: {
        Row: {
          question_id: string
          tag_id: string
        }
        Insert: {
          question_id: string
          tag_id: string
        }
        Update: {
          question_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qb_question_tags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "qb_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qb_question_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "qb_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      qb_import_batches: {
        Row: {
          id: string
          tenant: string
          imported_by: string
          file_name: string
          total_rows: number
          success_count: number
          error_count: number
          imported_at: string
        }
        Insert: {
          id?: string
          tenant: string
          imported_by: string
          file_name: string
          total_rows?: number
          success_count?: number
          error_count?: number
          imported_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          imported_by?: string
          file_name?: string
          total_rows?: number
          success_count?: number
          error_count?: number
          imported_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qb_import_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      // ─── Comunidad Estratégica tables ──────────────────────────────────
      game_settings: {
        Row: {
          id: string
          tenant: string
          game_enabled: boolean
          game_visibility: Database["public"]["Enums"]["game_visibility"]
          display_name: string
          nickname_change_cooldown_days: number
          quiz_question_count: number
          scoring_mode: Database["public"]["Enums"]["game_scoring_mode"]
          show_real_name: boolean
          badge_image_max_bytes: number
          badge_image_recommended_px: number
          hero_image_path: string | null
          recent_achievements_count: number
          lives_enabled: boolean
          lives_max: number
          lives_start: number
          lives_block_when_empty: boolean
          lives_regen_mode: Database["public"]["Enums"]["game_lives_regen_mode"]
          lives_regen_hours: number
          section_name_daily_question: string
          section_name_streak: string
          section_name_ranking: string
          section_name_challenges: string
          section_name_badges: string
          section_name_weekly_case: string
          icon: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          game_enabled?: boolean
          game_visibility?: Database["public"]["Enums"]["game_visibility"]
          display_name?: string
          nickname_change_cooldown_days?: number
          quiz_question_count?: number
          scoring_mode?: Database["public"]["Enums"]["game_scoring_mode"]
          show_real_name?: boolean
          badge_image_max_bytes?: number
          badge_image_recommended_px?: number
          hero_image_path?: string | null
          recent_achievements_count?: number
          lives_enabled?: boolean
          lives_max?: number
          lives_start?: number
          lives_block_when_empty?: boolean
          lives_regen_mode?: Database["public"]["Enums"]["game_lives_regen_mode"]
          lives_regen_hours?: number
          section_name_daily_question?: string
          section_name_streak?: string
          section_name_ranking?: string
          section_name_challenges?: string
          section_name_badges?: string
          section_name_weekly_case?: string
          icon?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          game_enabled?: boolean
          game_visibility?: Database["public"]["Enums"]["game_visibility"]
          display_name?: string
          nickname_change_cooldown_days?: number
          quiz_question_count?: number
          scoring_mode?: Database["public"]["Enums"]["game_scoring_mode"]
          show_real_name?: boolean
          badge_image_max_bytes?: number
          badge_image_recommended_px?: number
          hero_image_path?: string | null
          recent_achievements_count?: number
          lives_enabled?: boolean
          lives_max?: number
          lives_start?: number
          lives_block_when_empty?: boolean
          lives_regen_mode?: Database["public"]["Enums"]["game_lives_regen_mode"]
          lives_regen_hours?: number
          section_name_daily_question?: string
          section_name_streak?: string
          section_name_ranking?: string
          section_name_challenges?: string
          section_name_badges?: string
          section_name_weekly_case?: string
          icon?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_point_sources: {
        Row: {
          id: string
          tenant: string
          action_type: Database["public"]["Enums"]["game_action_type"]
          points_value: number
          enabled: boolean
          counts_for_streak: boolean
          costs_life: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          action_type: Database["public"]["Enums"]["game_action_type"]
          points_value?: number
          enabled?: boolean
          counts_for_streak?: boolean
          costs_life?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          action_type?: Database["public"]["Enums"]["game_action_type"]
          points_value?: number
          enabled?: boolean
          counts_for_streak?: boolean
          costs_life?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_streak_thresholds: {
        Row: {
          id: string
          tenant: string
          days: number
          label: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant: string
          days: number
          label?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          days?: number
          label?: string | null
          created_at?: string
        }
        Relationships: []
      }
      game_level_thresholds: {
        Row: {
          id: string
          tenant: string
          level: number
          min_points: number
          label: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          level: number
          min_points: number
          label?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          level?: number
          min_points?: number
          label?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_profiles: {
        Row: {
          id: string
          user_id: string
          tenant: string
          nickname: string | null
          nickname_normalized: string | null
          nickname_updated_at: string | null
          current_streak: number
          longest_streak: number
          last_activity_date: string | null
          current_lives: number | null
          lives_updated_at: string | null
          xp_reset_at: string | null
          is_restricted: boolean
          restricted_at: string | null
          restricted_by: string | null
          is_banned: boolean
          banned_at: string | null
          banned_by: string | null
          ban_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tenant: string
          nickname?: string | null
          nickname_normalized?: string | null
          nickname_updated_at?: string | null
          current_streak?: number
          longest_streak?: number
          last_activity_date?: string | null
          current_lives?: number | null
          lives_updated_at?: string | null
          xp_reset_at?: string | null
          is_restricted?: boolean
          restricted_at?: string | null
          restricted_by?: string | null
          is_banned?: boolean
          banned_at?: string | null
          banned_by?: string | null
          ban_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tenant?: string
          nickname?: string | null
          nickname_normalized?: string | null
          nickname_updated_at?: string | null
          current_streak?: number
          longest_streak?: number
          last_activity_date?: string | null
          current_lives?: number | null
          lives_updated_at?: string | null
          xp_reset_at?: string | null
          is_restricted?: boolean
          restricted_at?: string | null
          restricted_by?: string | null
          is_banned?: boolean
          banned_at?: string | null
          banned_by?: string | null
          ban_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_point_events: {
        Row: {
          id: string
          tenant: string
          user_id: string
          action_type: Database["public"]["Enums"]["game_action_type"]
          points_awarded: number
          source_ref: string | null
          subject_id: string | null
          category_id: string | null
          score_period_id: string | null
          occurred_at: string
          occurred_date: string
        }
        Insert: {
          id?: string
          tenant: string
          user_id: string
          action_type: Database["public"]["Enums"]["game_action_type"]
          points_awarded?: number
          source_ref?: string | null
          subject_id?: string | null
          category_id?: string | null
          score_period_id?: string | null
          occurred_at?: string
          occurred_date: string
        }
        Update: {
          id?: string
          tenant?: string
          user_id?: string
          action_type?: Database["public"]["Enums"]["game_action_type"]
          points_awarded?: number
          source_ref?: string | null
          subject_id?: string | null
          category_id?: string | null
          score_period_id?: string | null
          occurred_at?: string
          occurred_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_point_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_point_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "qb_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_point_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "qb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_point_events_score_period_id_fkey"
            columns: ["score_period_id"]
            isOneToOne: false
            referencedRelation: "game_score_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      game_daily_questions: {
        Row: {
          id: string
          tenant: string
          question_date: string
          question_id: string
          is_manually_curated: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant: string
          question_date: string
          question_id: string
          is_manually_curated?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          question_date?: string
          question_id?: string
          is_manually_curated?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_daily_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "qb_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_quiz_subject_settings: {
        Row: {
          id: string
          tenant: string
          subject_id: string
          quiz_question_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          subject_id: string
          quiz_question_count: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          subject_id?: string
          quiz_question_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_quiz_subject_settings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "qb_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      game_challenges: {
        Row: {
          id: string
          tenant: string
          title: string
          description: string | null
          criteria: Json
          period_type: Database["public"]["Enums"]["game_challenge_period_type"]
          starts_at: string | null
          ends_at: string | null
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          title: string
          description?: string | null
          criteria: Json
          period_type: Database["public"]["Enums"]["game_challenge_period_type"]
          starts_at?: string | null
          ends_at?: string | null
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          title?: string
          description?: string | null
          criteria?: Json
          period_type?: Database["public"]["Enums"]["game_challenge_period_type"]
          starts_at?: string | null
          ends_at?: string | null
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_challenge_progress: {
        Row: {
          id: string
          tenant: string
          user_id: string
          challenge_id: string
          progress_count: number
          completed_at: string | null
          last_event_id: string | null
          period_start: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          user_id: string
          challenge_id: string
          progress_count?: number
          completed_at?: string | null
          last_event_id?: string | null
          period_start?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          user_id?: string
          challenge_id?: string
          progress_count?: number
          completed_at?: string | null
          last_event_id?: string | null
          period_start?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_challenge_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "game_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      game_badges: {
        Row: {
          id: string
          tenant: string
          name: string
          description: string | null
          image_path: string | null
          audience: string[]
          unlock_type: Database["public"]["Enums"]["game_badge_unlock_type"]
          criteria: Json | null
          series_key: string | null
          series_order: number | null
          hide_criteria: boolean
          enabled: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          name: string
          description?: string | null
          image_path?: string | null
          audience?: string[]
          unlock_type: Database["public"]["Enums"]["game_badge_unlock_type"]
          criteria?: Json | null
          series_key?: string | null
          series_order?: number | null
          hide_criteria?: boolean
          enabled?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          name?: string
          description?: string | null
          image_path?: string | null
          audience?: string[]
          unlock_type?: Database["public"]["Enums"]["game_badge_unlock_type"]
          criteria?: Json | null
          series_key?: string | null
          series_order?: number | null
          hide_criteria?: boolean
          enabled?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          id: string
          tenant: string
          user_id: string
          badge_id: string
          granted_at: string
          granted_by: string | null
          grant_method: Database["public"]["Enums"]["game_badge_grant_method"]
          created_at: string
        }
        Insert: {
          id?: string
          tenant: string
          user_id: string
          badge_id: string
          granted_at?: string
          granted_by?: string | null
          grant_method: Database["public"]["Enums"]["game_badge_grant_method"]
          created_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          user_id?: string
          badge_id?: string
          granted_at?: string
          granted_by?: string | null
          grant_method?: Database["public"]["Enums"]["game_badge_grant_method"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "game_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      game_score_periods: {
        Row: {
          id: string
          tenant: string
          started_at: string
          closed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant: string
          started_at: string
          closed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          started_at?: string
          closed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      game_score_reset_log: {
        Row: {
          id: string
          tenant: string
          executed_by: string
          executed_at: string
          reset_scope: Database["public"]["Enums"]["game_score_reset_scope"]
          closed_period_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant: string
          executed_by: string
          executed_at?: string
          reset_scope: Database["public"]["Enums"]["game_score_reset_scope"]
          closed_period_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          executed_by?: string
          executed_at?: string
          reset_scope?: Database["public"]["Enums"]["game_score_reset_scope"]
          closed_period_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_score_reset_log_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_score_reset_log_closed_period_id_fkey"
            columns: ["closed_period_id"]
            isOneToOne: false
            referencedRelation: "game_score_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      game_weekly_cases: {
        Row: {
          id: string
          tenant: string
          title: string
          content: string
          window_start: string
          window_end: string
          status: Database["public"]["Enums"]["game_weekly_case_status"]
          resolution_content: string
          resolution_published: boolean
          resolution_visibility: Database["public"]["Enums"]["game_resolution_visibility"]
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant: string
          title: string
          content: string
          window_start: string
          window_end: string
          status?: Database["public"]["Enums"]["game_weekly_case_status"]
          resolution_content?: string
          resolution_published?: boolean
          resolution_visibility?: Database["public"]["Enums"]["game_resolution_visibility"]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          title?: string
          content?: string
          window_start?: string
          window_end?: string
          status?: Database["public"]["Enums"]["game_weekly_case_status"]
          resolution_content?: string
          resolution_published?: boolean
          resolution_visibility?: Database["public"]["Enums"]["game_resolution_visibility"]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_weekly_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_weekly_case_answers: {
        Row: {
          id: string
          tenant: string
          case_id: string
          user_id: string
          answer_content: string
          submitted_at: string
          updated_at: string
          quality_score: number | null
          graded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant: string
          case_id: string
          user_id: string
          answer_content: string
          submitted_at?: string
          updated_at?: string
          quality_score?: number | null
          graded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant?: string
          case_id?: string
          user_id?: string
          answer_content?: string
          submitted_at?: string
          updated_at?: string
          quality_score?: number | null
          graded_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_weekly_case_answers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "game_weekly_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_weekly_case_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_weekly_case_answers_graded_by_fkey"
            columns: ["graded_by"]
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
      agenda_guardar_entrada_personal_alumno: {
        Args: {
          p_evento_id: string | null
          p_titulo: string
          p_fecha: string
          p_hora_inicio: string
          p_hora_fin: string
          p_categoria?: Database["public"]["Enums"]["agenda_categoria"]
          p_visibilidad?: Database["public"]["Enums"]["agenda_visibilidad"]
          p_dia_completo?: boolean
          p_descripcion?: string | null
          p_nota?: string | null
          p_lugar?: string | null
          p_enlace_conexion?: string | null
        }
        Returns: Json
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
      get_admin_prefetch: { Args: { p_admin_id?: string }; Returns: Json }
      get_admin_stats: { Args: never; Returns: Json }
      get_alumno_dashboard: { Args: { p_alumno_id: string }; Returns: Json }
      get_alumno_prefetch: { Args: { p_alumno_id: string }; Returns: Json }
      get_lector_prefetch: { Args: { p_lector_id: string }; Returns: Json }
      get_alumno_ficha:
        | { Args: { p_alumno_id: string; p_limit?: number }; Returns: Json }
        | {
            Args: { p_alumno_id: string; p_autor_id?: string; p_limit?: number }
            Returns: Json
          }
      get_is_prueba_locked: { Args: { p_prueba_id: string }; Returns: boolean }
      get_notas_clase: { Args: { p_horario_id: string }; Returns: Json }
      get_lectores_admin: {
        Args: Record<string, never>
        Returns: {
          activo: boolean
          apellido: string
          apellido_materno: string | null
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          last_sign_in_at: string | null
          nombre: string
          telefono: string | null
        }[]
      }
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
          last_sign_in_at: string | null
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
          last_sign_in_at: string | null
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
      get_profesor_prefetch: { Args: { p_profesor_id: string }; Returns: Json }
      get_recursos_for_user: { Args: never; Returns: Json }
      propagate_folder_permissions: {
        Args: {
          p_folder_id: string
          p_para_todos: boolean
          p_para_todos_app: boolean
          p_alumno_ids: string[]
        }
        Returns: undefined
      }
      get_server_time: { Args: never; Returns: string }
      get_user_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["user_rol"]
      }
      is_own_recurso: { Args: { p_recurso_id: string }; Returns: boolean }
      set_ui_preference: {
        Args: { p_key: string; p_value: Json }
        Returns: Json
      }
      get_qb_questions: {
        Args: {
          p_tenant: string
          p_search?: string | null
          p_category_id?: string | null
          p_tag_ids?: string[] | null
          p_type?: string | null
          p_difficulty?: string | null
          p_status?: string | null
          p_date_from?: string | null
          p_date_to?: string | null
          p_subject_id?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: Json
      }
      game_is_accessible: {
        Args: { p_tenant: string }
        Returns: boolean
      }
      upsert_game_nickname: {
        Args: { p_tenant: string; p_nickname: string }
        Returns: Json
      }
      select_daily_question: {
        Args: { p_tenant: string }
        Returns: string
      }
      answer_daily_question: {
        Args: { p_tenant: string; p_answer: Json }
        Returns: Json
      }
      apply_streak: {
        Args: { p_tenant: string; p_user_id: string; p_today: string }
        Returns: { o_current: number; o_longest: number }[]
      }
      start_quiz: {
        Args: { p_tenant: string; p_subject_id: string; p_category_id?: string | null }
        Returns: Json
      }
      submit_quiz: {
        Args: {
          p_tenant: string
          p_subject_id: string
          p_category_id?: string | null
          p_answers: Json
        }
        Returns: Json
      }
      get_quiz_subjects: {
        Args: { p_tenant: string }
        Returns: Json
      }
      get_monthly_ranking: {
        Args: {
          p_tenant: string
          p_month?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: Json
      }
      get_my_ranking_position: {
        Args: { p_tenant: string; p_month?: string }
        Returns: Json
      }
      evaluate_challenges_for_event: {
        Args: { p_event_id: string }
        Returns: Json
      }
      get_active_challenges: {
        Args: { p_tenant: string }
        Returns: Json
      }
      get_user_badges: {
        Args: { p_tenant: string }
        Returns: Json
      }
      grant_badge_manual: {
        Args: { p_tenant: string; p_badge_id: string; p_user_id: string }
        Returns: Json
      }
      backfill_badge: {
        Args: { p_tenant: string; p_badge_id: string }
        Returns: number
      }
      delete_badge: {
        Args: { p_tenant: string; p_badge_id: string; p_force?: boolean }
        Returns: Json
      }
      get_game_stats: {
        Args: { p_tenant: string }
        Returns: Json
      }
      reset_game_scores: {
        Args: {
          p_tenant: string
          p_scope: Database["public"]["Enums"]["game_score_reset_scope"]
          p_confirmation: string
        }
        Returns: Json
      }
      get_quiz_categories: {
        Args: { p_tenant: string; p_subject_id: string }
        Returns: Json
      }
      get_game_profile: {
        Args: { p_tenant: string }
        Returns: Json
      }
      get_recent_achievements: {
        Args: { p_tenant: string; p_limit?: number }
        Returns: Json
      }
      list_game_players: {
        Args: { p_tenant: string; p_search?: string }
        Returns: Json
      }
      restrict_player: {
        Args: { p_tenant: string; p_user_id: string }
        Returns: Json
      }
      unrestrict_player: {
        Args: { p_tenant: string; p_user_id: string }
        Returns: Json
      }
      ban_player: {
        Args: { p_tenant: string; p_user_id: string; p_reason?: string }
        Returns: Json
      }
      unban_player: {
        Args: { p_tenant: string; p_user_id: string }
        Returns: Json
      }
      set_player_lives: {
        Args: { p_tenant: string; p_user_id: string; p_lives: number }
        Returns: Json
      }
      reset_player_level: {
        Args: { p_tenant: string; p_user_id: string }
        Returns: Json
      }
      get_current_weekly_case: {
        Args: { p_tenant: string }
        Returns: Json
      }
      get_weekly_case_detail: {
        Args: { p_tenant: string; p_case_id: string }
        Returns: Json
      }
      get_weekly_case_history: {
        Args: { p_tenant: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      submit_weekly_case_answer: {
        Args: { p_tenant: string; p_case_id: string; p_answer_content: string }
        Returns: Json
      }
      publish_weekly_case_resolution: {
        Args: {
          p_tenant: string
          p_case_id: string
          p_resolution_content: string
          p_visibility: Database["public"]["Enums"]["game_resolution_visibility"]
        }
        Returns: Json
      }
    }
    Enums: {
      agenda_alcance: "personal" | "alumnos_seleccionados" | "todos_alumnos"
      agenda_visibilidad: "privada" | "publica"
      agenda_categoria:
        | "clase"
        | "reunion"
        | "estudio"
        | "personal"
        | "administrativo"
        | "evento_externo"
        | "plazo"
        | "otro"
      estado_asistencia:
        | "pendiente"
        | "confirmado"
        | "cancelado"
        | "cambiado"
        | "no_asistio"
      tipo_clase: "normal" | "interrogacion" | "simulacion"
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
        | "invitacion_acceso"
        | "bienvenida_registro"
        | "nueva_nota_clase"
        | "recordatorio_clase"
        | "nueva_actividad"
        | "nueva_simulacion"
      user_rol: "admin" | "profesor" | "alumno" | "lector"
      game_visibility: "admin_only" | "all_users"
      game_action_type:
        | "quiz_completed"
        | "daily_question_answered"
        | "interrogacion_completed"
        | "weekly_case_participated"
        | "study_hours_logged"
      game_scoring_mode: "fixed" | "proportional"
      game_challenge_period_type: "weekly" | "monthly" | "custom"
      game_badge_unlock_type: "automatic" | "manual"
      game_badge_grant_method: "automatic" | "manual"
      game_score_reset_scope: "current-month-ranking-only" | "full-history-archive"
      game_weekly_case_status: "draft" | "open" | "closed" | "resolved"
      game_resolution_visibility: "participants_only" | "all_users"
      game_lives_regen_mode: "per_life" | "full_refill"
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
      agenda_alcance: ["personal", "alumnos_seleccionados", "todos_alumnos"],
      agenda_visibilidad: ["privada", "publica"],
      agenda_categoria: [
        "clase",
        "reunion",
        "estudio",
        "personal",
        "administrativo",
        "evento_externo",
        "plazo",
        "otro",
      ],
      estado_asistencia: [
        "pendiente",
        "confirmado",
        "cancelado",
        "cambiado",
        "no_asistio",
      ],
      tipo_clase: ["normal", "interrogacion", "simulacion"],
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
        "invitacion_acceso",
        "bienvenida_registro",
        "nueva_nota_clase",
        "recordatorio_clase",
        "nueva_actividad",
        "nueva_simulacion",
      ],
      user_rol: ["admin", "profesor", "alumno", "lector"],
      game_visibility: ["admin_only", "all_users"],
      game_action_type: [
        "quiz_completed",
        "daily_question_answered",
        "interrogacion_completed",
        "weekly_case_participated",
        "study_hours_logged",
      ],
      game_scoring_mode: ["fixed", "proportional"],
      game_challenge_period_type: ["weekly", "monthly", "custom"],
      game_badge_unlock_type: ["automatic", "manual"],
      game_badge_grant_method: ["automatic", "manual"],
      game_score_reset_scope: ["current-month-ranking-only", "full-history-archive"],
      game_weekly_case_status: ["draft", "open", "closed", "resolved"],
      game_resolution_visibility: ["participants_only", "all_users"],
      game_lives_regen_mode: ["per_life", "full_refill"],
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
export type EnlaceInvitacion = Tables<'enlaces_invitacion'>;

// ─── Comunidad Estratégica type aliases ──────────────────────────────────────
export type GameVisibility = Database['public']['Enums']['game_visibility'];
export type GameActionType = Database['public']['Enums']['game_action_type'];
export type GameScoringMode = Database['public']['Enums']['game_scoring_mode'];
export type GameChallengePeriodType = Database['public']['Enums']['game_challenge_period_type'];
export type GameSettings = Tables<'game_settings'>;
export type GamePointSource = Tables<'game_point_sources'>;
export type GameStreakThreshold = Tables<'game_streak_thresholds'>;
export type GameProfile = Tables<'game_profiles'>;
export type GamePointEvent = Tables<'game_point_events'>;
export type GameDailyQuestion = Tables<'game_daily_questions'>;
export type GameQuizSubjectSettings = Tables<'game_quiz_subject_settings'>;
export type GameChallenge = Tables<'game_challenges'>;
export type GameChallengeProgress = Tables<'game_challenge_progress'>;
export type GameBadgeUnlockType = Database['public']['Enums']['game_badge_unlock_type'];
export type GameBadgeGrantMethod = Database['public']['Enums']['game_badge_grant_method'];
export type GameScoreResetScope = Database['public']['Enums']['game_score_reset_scope'];
export type GameBadge = Tables<'game_badges'>;
export type UserBadge = Tables<'user_badges'>;
export type GameScorePeriod = Tables<'game_score_periods'>;
export type GameScoreResetLog = Tables<'game_score_reset_log'>;
export type GameWeeklyCaseStatus = Database['public']['Enums']['game_weekly_case_status'];
export type GameResolutionVisibility = Database['public']['Enums']['game_resolution_visibility'];
export type GameWeeklyCase = Tables<'game_weekly_cases'>;
export type GameWeeklyCaseAnswer = Tables<'game_weekly_case_answers'>;
export type GameLivesRegenMode = Database['public']['Enums']['game_lives_regen_mode'];
export type GameLevelThreshold = Tables<'game_level_thresholds'>;

export type EmailPlantilla = Tables<'email_plantillas'>;
export type EmailEnvio = Tables<'email_envios'>;

// ─── Simulación type aliases ─────────────────────────────────────────────────

export type TipoClase = Database['public']['Enums']['tipo_clase'];
export type SimulacionComision = Tables<'simulacion_comision'>;
export type SimulacionEvaluacion = Tables<'simulacion_evaluaciones'>;

// ─── Agenda type aliases ─────────────────────────────────────────────────────

export type AgendaAlcance = Database['public']['Enums']['agenda_alcance'];
export type AgendaVisibilidad = Database['public']['Enums']['agenda_visibilidad'];
export type CategoriaAgenda = Database['public']['Enums']['agenda_categoria'];

export type AgendaEvento = Tables<'agenda_eventos'>;
export type AgendaEventoDestinatario = Tables<'agenda_evento_destinatarios'>;
export type AgendaEventoOcultacion = Tables<'agenda_evento_ocultaciones'>;

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
    apellido_materno: string | null;
    avatar_url: string | null;
    rol: UserRol;
  };
};

export type TenantContactInfo = Tables<'tenant_contact_info'>;
export type LandingPlanesConfig = Tables<'landing_planes_config'>;
export type LandingSobreNosotrasConfig = Tables<'landing_sobre_nosotras_config'>;

// ─── Referral System type aliases ────────────────────────────────────────────

export type UserReferralCode = Tables<'user_referral_codes'>;
export type ReferralSettingsRow = Tables<'referral_settings'>;
export type ReferralRewardRuleRow = Tables<'referral_reward_rules'>;
export type DiscountCodeRow = Tables<'discount_codes'>;
export type ReferralUsageRow = Tables<'referral_usages'>;

// ─── Question Bank type aliases ──────────────────────────────────────────────

export type QbQuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'open_ended' | 'fill_blank' | 'matching';
export type QbDifficulty = 'easy' | 'medium' | 'hard';
export type QbStatus = 'draft' | 'active';

export type QbQuestionBankSettings = {
  id: string;
  tenant: string;
  question_bank_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type QbSubject = {
  id: string;
  tenant: string;
  name: string;
  keywords: string[];
  created_at: string;
  updated_at: string;
};

export type QbCategory = {
  id: string;
  tenant: string;
  name: string;
  keywords: string[];
  created_at: string;
  updated_at: string;
};

export type QbTag = {
  id: string;
  tenant: string;
  name: string;
  keywords: string[];
  created_at: string;
  updated_at: string;
};

export type QbQuestionOption = {
  text: string;
  is_correct: boolean;
};

export type QbTrueFalseOptions = {
  correct_answer: boolean;
};

export type QbOpenEndedOptions = {
  model_answer?: string;
};

export type QbFillBlankOptions = {
  blanks: Array<{ position: number; accepted_answers: string[] }>;
};

export type QbMatchingPair = {
  left: string;
  right: string;
};

export type QbMatchingOptions = {
  pairs: QbMatchingPair[];
};

export type QbQuestion = {
  id: string;
  tenant: string;
  type: QbQuestionType;
  content: string;
  options: QbQuestionOption[] | QbTrueFalseOptions | QbOpenEndedOptions | QbFillBlankOptions | QbMatchingOptions;
  explanation: string | null;
  subject_id: string | null;
  category_id: string | null;
  difficulty: QbDifficulty | null;
  status: QbStatus;
  import_batch_id: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QbQuestionWithRelations = QbQuestion & {
  subject_name: string | null;
  category_name: string | null;
  created_by_nombre: string | null;
  created_by_apellido: string | null;
  created_by_apellido_materno: string | null;
  tags: Array<{ id: string; name: string }> | null;
};

export type QbImportBatch = {
  id: string;
  tenant: string;
  imported_by: string;
  file_name: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  imported_at: string;
};
