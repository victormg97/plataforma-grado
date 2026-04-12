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
      alumnos_extra: {
        Row: {
          alumno_id: string
          año_ingreso: string | null
          created_at: string
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
          año_ingreso?: string | null
          created_at?: string
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
          año_ingreso?: string | null
          created_at?: string
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
          expires_at: string
          id: string
          used: boolean | null
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          used?: boolean | null
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
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
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          apellido: string
          apellido_materno: string | null
          avatar_url: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      get_notas_clase: { Args: { p_horario_id: string }; Returns: Json }
      get_profesor_dashboard: { Args: { p_profesor_id: string }; Returns: Json }
      get_server_time: { Args: never; Returns: string }
      get_user_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["user_rol"]
      }
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
      ],
      user_rol: ["admin", "profesor", "alumno"],
    },
  },
} as const
