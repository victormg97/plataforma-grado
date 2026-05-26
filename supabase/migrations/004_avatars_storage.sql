-- Crear bucket público para avatares de usuario
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Política: cualquier usuario autenticado puede subir/reemplazar
-- su propio avatar (ruta: {user_id}/avatar.jpg)
create policy "avatars: upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Política: lectura pública (bucket ya es público, pero RLS aún aplica)
create policy "avatars: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');
