// Enums
export type UserRol = 'admin' | 'profesor' | 'alumno';
export type EstadoAsistencia = 'pendiente' | 'confirmado' | 'cancelado' | 'cambiado' | 'no_asistio';
export type TipoNotificacion = 'confirmacion' | 'cancelacion' | 'cambio_horario' | 'nueva_clase' | 'clase_modificada' | 'clase_cancelada';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

// Tabla profiles
export type Profile = {
  id: string;
  rol: UserRol;
  nombre: string;
  apellido: string;
  apellido_materno: string | null;
  email: string;
  telefono: string | null;
  avatar_url: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// Tabla alumnos_extra
export type AlumnoExtra = {
  id: string;
  alumno_id: string;
  profesor_id: string | null;
  universidad: string | null;
  año_ingreso: string | null;
  notas: string | null;
  paso_prueba: boolean;
  fecha_prueba: string | null;
  created_at: string;
  updated_at: string;
}

// Tabla horarios
export type Horario = {
  id: string;
  profesor_id: string;
  alumno_id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  es_recurrente: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// Tabla asistencia
export type Asistencia = {
  id: string;
  horario_id: string;
  alumno_id: string;
  estado: EstadoAsistencia;
  nuevo_horario_id: string | null;
  nota_alumno: string | null;
  created_at: string;
  updated_at: string;
}

// Tabla notificaciones
export type Notificacion = {
  id: string;
  destinatario_id: string;
  tipo: TipoNotificacion;
  mensaje: string;
  leida: boolean;
  horario_id: string | null;
  alumno_id: string | null;
  created_at: string;
}

// Database type for Supabase client
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      alumnos_extra: {
        Row: AlumnoExtra;
        Insert: Omit<AlumnoExtra, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<AlumnoExtra, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [
          {
            foreignKeyName: "alumnos_extra_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alumnos_extra_profesor_id_fkey";
            columns: ["profesor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      horarios: {
        Row: Horario;
        Insert: Omit<Horario, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Horario, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [
          {
            foreignKeyName: "horarios_profesor_id_fkey";
            columns: ["profesor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "horarios_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      asistencia: {
        Row: Asistencia;
        Insert: Omit<Asistencia, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Asistencia, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [
          {
            foreignKeyName: "asistencia_horario_id_fkey";
            columns: ["horario_id"];
            isOneToOne: false;
            referencedRelation: "horarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asistencia_alumno_id_fkey";
            columns: ["alumno_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notificaciones: {
        Row: Notificacion;
        Insert: Omit<Notificacion, 'id' | 'created_at'>;
        Update: Partial<Omit<Notificacion, 'id' | 'created_at'>>;
        Relationships: [
          {
            foreignKeyName: "notificaciones_destinatario_id_fkey";
            columns: ["destinatario_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificaciones_horario_id_fkey";
            columns: ["horario_id"];
            isOneToOne: false;
            referencedRelation: "horarios";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_profesor_dashboard: {
        Args: { p_profesor_id: string };
        Returns: Json;
      };
      get_alumno_dashboard: {
        Args: { p_alumno_id: string };
        Returns: Json;
      };
      get_admin_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_alumno_ficha: {
        Args: { p_alumno_id: string; p_limit?: number };
        Returns: Json;
      };
    };
    Enums: {
      user_rol: UserRol;
      estado_asistencia: EstadoAsistencia;
      tipo_notificacion: TipoNotificacion;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
