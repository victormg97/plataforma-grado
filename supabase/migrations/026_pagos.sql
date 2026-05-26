-- Tabla de pagos mensuales
-- Un registro por (alumno_id, año, mes). Ausencia de registro = pendiente.

create table public.pagos (
  id            uuid default uuid_generate_v4() primary key,
  alumno_id     uuid references public.profiles(id) on delete cascade not null,
  anio          integer not null,
  mes           integer not null check (mes >= 1 and mes <= 12),
  estado        text not null default 'pagado' check (estado in ('pagado', 'parcial')),
  monto_pagado  integer, -- CLP, obligatorio para parcial
  fecha_pago    timestamptz not null default now(),
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint pagos_alumno_mes_unique unique (alumno_id, anio, mes)
);

create trigger pagos_updated_at
  before update on public.pagos
  for each row execute function update_updated_at();

alter table public.pagos enable row level security;

-- Solo el admin puede gestionar pagos

create policy "admin_pagos_select" on public.pagos
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and rol = 'admin'
    )
  );

create policy "admin_pagos_insert" on public.pagos
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and rol = 'admin'
    )
  );

create policy "admin_pagos_update" on public.pagos
  for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and rol = 'admin'
    )
  );

create policy "admin_pagos_delete" on public.pagos
  for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and rol = 'admin'
    )
  );
