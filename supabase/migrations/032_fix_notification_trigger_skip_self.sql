-- ============================================================
-- Fix: Don't create notification when the profesor/admin
-- themselves change the attendance status.
-- Only notify the profesor when the ALUMNO changes their status.
-- ============================================================

create or replace function create_notification_on_asistencia_change()
returns trigger as $$
declare
  v_profesor_id uuid;
  v_titulo      text;
  v_nombre      text;
  v_tipo        tipo_notificacion;
  v_mensaje     text;
  v_current_user uuid;
begin
  -- Only act when estado actually changes to a notification-worthy value
  if new.estado = old.estado then
    return new;
  end if;

  if new.estado::text not in ('confirmado', 'cancelado', 'cambiado') then
    return new;
  end if;

  -- Fetch the horario's profesor_id and titulo
  select profesor_id, titulo
    into v_profesor_id, v_titulo
    from public.horarios
   where id = new.horario_id;

  if v_profesor_id is null then
    return new;
  end if;

  -- Get the current authenticated user
  v_current_user := auth.uid();

  -- Skip notification if the person making the change IS NOT the alumno
  -- (i.e., it's the profesor or admin changing it — no need to notify themselves)
  if v_current_user is not null and v_current_user != new.alumno_id then
    return new;
  end if;

  -- Fetch the alumno's full name
  select nombre || ' ' || apellido
    into v_nombre
    from public.profiles
   where id = new.alumno_id;

  v_nombre := coalesce(v_nombre, 'Un alumno');
  v_titulo := coalesce(v_titulo, 'clase');

  -- Map estado → tipo + mensaje
  case new.estado::text
    when 'confirmado' then
      v_tipo    := 'confirmacion';
      v_mensaje := v_nombre || ' confirmó su asistencia a "' || v_titulo || '"';
    when 'cancelado' then
      v_tipo    := 'cancelacion';
      v_mensaje := v_nombre || ' canceló su asistencia a "' || v_titulo || '"';
    when 'cambiado' then
      v_tipo    := 'cambio_horario';
      v_mensaje := v_nombre || ' solicitó cambio de horario para "' || v_titulo || '"';
  end case;

  insert into public.notificaciones
    (destinatario_id, tipo, mensaje, horario_id, alumno_id, leida)
  values
    (v_profesor_id, v_tipo, v_mensaje, new.horario_id, new.alumno_id, false);

  return new;
end;
$$ language plpgsql security definer;
