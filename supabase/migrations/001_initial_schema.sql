-- Habilitar extensiones (suppress NOTICE if already exists)
set client_min_messages to 'warning';
create extension if not exists "uuid-ossp";
set client_min_messages to 'notice';

-- Enum para roles
create type user_rol as enum ('admin', 'profesor', 'alumno');

-- Enum para estado de asistencia
create type estado_asistencia as enum ('pendiente', 'confirmado', 'cancelado', 'cambiado');

-- Enum para tipo de notificación
create type tipo_notificacion as enum ('confirmacion', 'cancelacion', 'cambio_horario');

-- Tabla profiles (extiende auth.users de Supabase)
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  rol         user_rol not null default 'alumno',
  nombre      text not null,
  apellido    text not null,
  email       text not null unique,
  telefono    text,
  avatar_url  text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tabla alumnos_extra (ficha extendida)
create table public.alumnos_extra (
  id              uuid default uuid_generate_v4() primary key,
  alumno_id       uuid references public.profiles(id) on delete cascade not null unique,
  profesor_id     uuid references public.profiles(id) on delete set null,
  universidad     text,
  año_ingreso     text,
  notas           text,
  paso_prueba     boolean not null default false,
  fecha_prueba    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Tabla horarios
create table public.horarios (
  id              uuid default uuid_generate_v4() primary key,
  profesor_id     uuid references public.profiles(id) on delete cascade not null,
  alumno_id       uuid references public.profiles(id) on delete cascade not null,
  titulo          text not null,
  descripcion     text,
  fecha           date not null,
  hora_inicio     time not null,
  hora_fin        time not null,
  es_recurrente   boolean not null default false,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Tabla asistencia
create table public.asistencia (
  id                uuid default uuid_generate_v4() primary key,
  horario_id        uuid references public.horarios(id) on delete cascade not null,
  alumno_id         uuid references public.profiles(id) on delete cascade not null,
  estado            estado_asistencia not null default 'pendiente',
  nuevo_horario_id  uuid references public.horarios(id) on delete set null,
  nota_alumno       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(horario_id, alumno_id)
);

-- Tabla notificaciones
create table public.notificaciones (
  id                uuid default uuid_generate_v4() primary key,
  destinatario_id   uuid references public.profiles(id) on delete cascade not null,
  tipo              tipo_notificacion not null,
  mensaje           text not null,
  leida             boolean not null default false,
  horario_id        uuid references public.horarios(id) on delete set null,
  alumno_id         uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- Trigger para updated_at automático
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function update_updated_at();
create trigger alumnos_extra_updated_at before update on public.alumnos_extra
  for each row execute function update_updated_at();
create trigger horarios_updated_at before update on public.horarios
  for each row execute function update_updated_at();
create trigger asistencia_updated_at before update on public.asistencia
  for each row execute function update_updated_at();

-- Trigger para crear profile automáticamente al registrar usuario
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nombre, apellido, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', 'Usuario'),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    coalesce((new.raw_user_meta_data->>'rol')::user_rol, 'alumno')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Habilitar RLS
alter table public.profiles enable row level security;
alter table public.alumnos_extra enable row level security;
alter table public.horarios enable row level security;
alter table public.asistencia enable row level security;
alter table public.notificaciones enable row level security;

-- Helper: obtener rol del usuario actual
create or replace function get_user_rol()
returns user_rol as $$
  select rol from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Políticas profiles
create policy "Usuarios ven su propio perfil" on public.profiles
  for select using (auth.uid() = id);
create policy "Admin ve todos los perfiles" on public.profiles
  for select using (get_user_rol() = 'admin');
create policy "Profesor ve todos los alumnos" on public.profiles
  for select using (
    get_user_rol() = 'profesor' and rol = 'alumno'
  );
create policy "Profesor ve otros profesores" on public.profiles
  for select using (
    get_user_rol() = 'profesor' and rol = 'profesor'
  );
create policy "Usuario actualiza su propio perfil" on public.profiles
  for update using (auth.uid() = id);
create policy "Admin gestiona todos los perfiles" on public.profiles
  for all using (get_user_rol() = 'admin');

-- Políticas alumnos_extra
create policy "Alumno ve su propia ficha" on public.alumnos_extra
  for select using (alumno_id = auth.uid());
create policy "Profesor ve todas las fichas" on public.alumnos_extra
  for select using (get_user_rol() = 'profesor');
create policy "Profesor edita fichas de sus alumnos" on public.alumnos_extra
  for update using (profesor_id = auth.uid());
create policy "Profesor inserta fichas de sus alumnos" on public.alumnos_extra
  for insert with check (profesor_id = auth.uid());
create policy "Admin gestiona todas las fichas" on public.alumnos_extra
  for all using (get_user_rol() = 'admin');

-- Políticas horarios
create policy "Alumno ve sus horarios" on public.horarios
  for select using (alumno_id = auth.uid());
create policy "Profesor gestiona sus horarios" on public.horarios
  for all using (profesor_id = auth.uid());
create policy "Admin gestiona todos los horarios" on public.horarios
  for all using (get_user_rol() = 'admin');

-- Políticas asistencia
create policy "Alumno ve y gestiona su asistencia" on public.asistencia
  for all using (alumno_id = auth.uid());
create policy "Profesor ve asistencia de sus alumnos" on public.asistencia
  for select using (
    exists (
      select 1 from public.horarios h
      where h.id = asistencia.horario_id and h.profesor_id = auth.uid()
    )
  );
create policy "Admin gestiona toda la asistencia" on public.asistencia
  for all using (get_user_rol() = 'admin');

-- Políticas notificaciones
create policy "Usuario ve sus propias notificaciones" on public.notificaciones
  for all using (destinatario_id = auth.uid());
create policy "Admin ve todas las notificaciones" on public.notificaciones
  for all using (get_user_rol() = 'admin');
