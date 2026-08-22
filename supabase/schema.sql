create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'es',
  legal_use_consented_at timestamptz,
  privacy_consented_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.grow_spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('Exterior', 'Interior', 'Invernadero')),
  approximate_region text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references public.grow_spaces(id) on delete cascade,
  name text not null,
  variety text,
  seed_profile_id text,
  seed_type text,
  custom_seed_notes text,
  started_at date,
  mode text not null check (mode in ('Exterior', 'Interior', 'Invernadero')),
  pot text,
  substrate text,
  lighting text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id uuid references public.plants(id) on delete cascade,
  title text not null,
  description text,
  category text not null check (category in ('Riego', 'Mantenimiento', 'Observacion', 'Registro')),
  recurrence_rule text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id uuid not null references public.plants(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null check (event_type in ('watering', 'photo', 'cleaning', 'review')),
  source text not null check (source in ('manual', 'horticultural')),
  start_date date not null,
  recurrence_active boolean not null default false,
  recurrence_every_days integer check (recurrence_every_days is null or recurrence_every_days > 0),
  recurrence_end_date date,
  completed_dates date[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.care_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id uuid references public.plants(id) on delete cascade,
  title text not null,
  note text,
  observed_at timestamptz not null default now(),
  weather_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id uuid references public.plants(id) on delete cascade,
  care_entry_id uuid references public.care_entries(id) on delete set null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.plant_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id uuid not null references public.plants(id) on delete cascade,
  measured_at timestamptz not null default now(),
  source text not null check (source in ('manual', 'sensor', 'device')),
  temperature_c numeric,
  leaf_temperature_c numeric,
  ambient_humidity_percent numeric,
  substrate_moisture_percent numeric,
  height_cm numeric,
  water_amount_ml numeric,
  irrigation_ph numeric check (irrigation_ph is null or irrigation_ph between 0 and 14),
  irrigation_ec_ms_cm numeric check (irrigation_ec_ms_cm is null or irrigation_ec_ms_cm >= 0),
  irrigation_ppm numeric check (irrigation_ppm is null or irrigation_ppm >= 0),
  runoff_amount_ml numeric check (runoff_amount_ml is null or runoff_amount_ml >= 0),
  runoff_ph numeric check (runoff_ph is null or runoff_ph between 0 and 14),
  runoff_ec_ms_cm numeric check (runoff_ec_ms_cm is null or runoff_ec_ms_cm >= 0),
  ppfd_umol_m2_s numeric check (ppfd_umol_m2_s is null or ppfd_umol_m2_s >= 0),
  lighting text,
  observations text,
  photo_id uuid references public.photos(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.plant_measurements
  add column if not exists ppfd_umol_m2_s numeric check (ppfd_umol_m2_s is null or ppfd_umol_m2_s >= 0);

alter table public.plant_measurements
  add column if not exists leaf_temperature_c numeric;

alter table public.plant_measurements
  add column if not exists irrigation_ph numeric check (irrigation_ph is null or irrigation_ph between 0 and 14),
  add column if not exists irrigation_ec_ms_cm numeric check (irrigation_ec_ms_cm is null or irrigation_ec_ms_cm >= 0),
  add column if not exists irrigation_ppm numeric check (irrigation_ppm is null or irrigation_ppm >= 0),
  add column if not exists runoff_amount_ml numeric check (runoff_amount_ml is null or runoff_amount_ml >= 0),
  add column if not exists runoff_ph numeric check (runoff_ph is null or runoff_ph between 0 and 14),
  add column if not exists runoff_ec_ms_cm numeric check (runoff_ec_ms_cm is null or runoff_ec_ms_cm >= 0);

create table if not exists public.plant_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id uuid not null references public.plants(id) on delete cascade,
  source text not null check (source in ('calculated', 'suggestion')),
  kind text not null check (kind in ('alert', 'comparison', 'missing-data', 'trend')),
  title text not null,
  body text not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_app_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null default 'primary',
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.profiles enable row level security;
alter table public.grow_spaces enable row level security;
alter table public.plants enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.care_entries enable row level security;
alter table public.photos enable row level security;
alter table public.plant_measurements enable row level security;
alter table public.plant_insights enable row level security;
alter table public.user_app_snapshots enable row level security;

grant select, insert, update, delete on public.plant_measurements to authenticated;
grant select, insert, update, delete on public.plant_insights to authenticated;
grant select, insert, update, delete on public.plant_measurements to service_role;
grant select, insert, update, delete on public.plant_insights to service_role;

-- Las politicas se borran antes de crearse para que este archivo se pueda
-- volver a ejecutar sin el error 42710 ("policy already exists").
drop policy if exists "profiles own rows" on public.profiles;
drop policy if exists "grow spaces own rows" on public.grow_spaces;
drop policy if exists "plants own rows" on public.plants;
drop policy if exists "tasks own rows" on public.tasks;
drop policy if exists "calendar events own rows" on public.calendar_events;
drop policy if exists "care entries own rows" on public.care_entries;
drop policy if exists "photos own rows" on public.photos;
drop policy if exists "plant measurements own rows" on public.plant_measurements;
drop policy if exists "plant insights own rows" on public.plant_insights;
drop policy if exists "app snapshots own rows" on public.user_app_snapshots;
drop policy if exists "plant photo owners can read" on storage.objects;
drop policy if exists "plant photo owners can upload" on storage.objects;
drop policy if exists "plant photo owners can delete" on storage.objects;

create policy "profiles own rows" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "grow spaces own rows" on public.grow_spaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "plants own rows" on public.plants
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tasks own rows" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "calendar events own rows" on public.calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "care entries own rows" on public.care_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "photos own rows" on public.photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "plant measurements own rows" on public.plant_measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "plant insights own rows" on public.plant_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "app snapshots own rows" on public.user_app_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', false)
on conflict (id) do nothing;

create policy "plant photo owners can read" on storage.objects
  for select using (bucket_id = 'plant-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "plant photo owners can upload" on storage.objects
  for insert with check (bucket_id = 'plant-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "plant photo owners can delete" on storage.objects
  for delete using (bucket_id = 'plant-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ---------------------------------------------------------------------------
-- Compartir cultivos en modo lectura
--
-- El dueno genera un codigo y se lo pasa a quien quiera. Quien lo canjea puede
-- LEER el respaldo del dueno, nunca escribirlo.
--
-- Se comparte con un codigo y no con el email a proposito: buscar usuarios por
-- direccion obligaria a exponer una tabla de emails, y cualquiera podria probar
-- direcciones para averiguar quien tiene cuenta.
-- ---------------------------------------------------------------------------

create table if not exists public.snapshot_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid references auth.users(id) on delete cascade,
  code text not null unique,
  owner_label text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create index if not exists snapshot_shares_viewer_idx on public.snapshot_shares (viewer_id);

alter table public.snapshot_shares enable row level security;

drop policy if exists "shares owner manages" on public.snapshot_shares;
drop policy if exists "shares viewer reads" on public.snapshot_shares;
drop policy if exists "shares viewer leaves" on public.snapshot_shares;

-- El dueno ve y administra los codigos que genero.
create policy "shares owner manages" on public.snapshot_shares
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- El invitado ve los permisos que le dieron, para poder listarlos.
create policy "shares viewer reads" on public.snapshot_shares
  for select using (auth.uid() = viewer_id);

-- El invitado puede soltar un permiso que ya no quiere.
create policy "shares viewer leaves" on public.snapshot_shares
  for delete using (auth.uid() = viewer_id);

-- Lectura del respaldo ajeno. Se suma a la politica de "solo mis filas": en
-- Postgres las politicas permisivas se combinan con OR, asi que esto agrega
-- lectura sin quitarle a nadie el control de lo suyo. Ojo que es solo SELECT:
-- escribir sigue exigiendo ser el dueno.
drop policy if exists "app snapshots shared read" on public.user_app_snapshots;

create policy "app snapshots shared read" on public.user_app_snapshots
  for select using (
    exists (
      select 1
      from public.snapshot_shares as share
      where share.owner_id = user_app_snapshots.user_id
        and share.viewer_id = auth.uid()
    )
  );

-- Canje del codigo.
--
-- Va como funcion security definer porque quien canjea todavia no tiene
-- permiso para ver esa fila: sin esto tendria que poder leer la tabla entera
-- de codigos para encontrar el suyo, y podria probar codigos ajenos.
create or replace function public.claim_snapshot_share(share_code text)
returns table (owner_id uuid, owner_label text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.snapshot_shares%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesion para usar un codigo';
  end if;

  select * into target
  from public.snapshot_shares
  where code = upper(trim(share_code));

  if not found then
    raise exception 'Ese codigo no existe';
  end if;

  if target.owner_id = auth.uid() then
    raise exception 'Ese codigo es tuyo';
  end if;

  -- Un codigo sirve para una sola persona: si ya lo canjeo otra, no se reusa.
  if target.viewer_id is not null and target.viewer_id <> auth.uid() then
    raise exception 'Ese codigo ya lo uso otra persona';
  end if;

  update public.snapshot_shares
  set viewer_id = auth.uid(),
      claimed_at = now()
  where id = target.id;

  return query select target.owner_id, target.owner_label;
end;
$$;

revoke all on function public.claim_snapshot_share(text) from public;
revoke execute on function public.claim_snapshot_share(text) from anon;
grant execute on function public.claim_snapshot_share(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Dispositivos y sensores
--
-- Cada dispositivo recibe un token propio una sola vez. Solo se almacena su
-- hash; ni el ESP32 ni el navegador conocen la clave service_role.
-- ---------------------------------------------------------------------------

create table if not exists public.sensor_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_ref text not null,
  name text not null,
  token_hash text not null unique,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- Compatibilidad con una ejecucion temprana del esquema que vinculaba el
-- dispositivo a public.plants. La app productiva usa IDs del snapshot.
alter table public.sensor_devices add column if not exists plant_ref text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sensor_devices' and column_name = 'plant_id'
  ) then
    execute 'update public.sensor_devices set plant_ref = plant_id::text where plant_ref is null';
    execute 'alter table public.sensor_devices drop column plant_id cascade';
  end if;
end;
$$;
alter table public.sensor_devices alter column plant_ref set not null;

create index if not exists sensor_devices_owner_idx on public.sensor_devices (user_id);
create index if not exists sensor_devices_plant_idx on public.sensor_devices (plant_ref);

create table if not exists public.sensor_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_ref text not null,
  device_id uuid not null references public.sensor_devices(id) on delete cascade,
  measured_at timestamptz not null default now(),
  temperature_c numeric,
  leaf_temperature_c numeric,
  ambient_humidity_percent numeric,
  substrate_moisture_percent numeric,
  ppfd_umol_m2_s numeric,
  observations text,
  created_at timestamptz not null default now()
);

create index if not exists sensor_measurements_owner_plant_idx
  on public.sensor_measurements (user_id, plant_ref, measured_at desc);

alter table public.sensor_devices enable row level security;
alter table public.sensor_measurements enable row level security;

drop policy if exists "sensor device owners manage" on public.sensor_devices;
create policy "sensor device owners manage" on public.sensor_devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sensor measurement owners read" on public.sensor_measurements;
create policy "sensor measurement owners read" on public.sensor_measurements
  for select using (auth.uid() = user_id);

grant select, update, delete on public.sensor_devices to authenticated;
grant select, insert, update, delete on public.sensor_devices to service_role;
grant select on public.sensor_measurements to authenticated;
grant select, insert, update, delete on public.sensor_measurements to service_role;

drop function if exists public.create_sensor_device(uuid, text);

create or replace function public.create_sensor_device(target_plant_ref text, device_name text)
returns table (device_id uuid, device_token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  raw_token text;
  new_device_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesion para crear un dispositivo';
  end if;

  if nullif(trim(target_plant_ref), '') is null then
    raise exception 'Falta identificar la maceta';
  end if;

  raw_token := encode(gen_random_bytes(24), 'hex');

  insert into public.sensor_devices (user_id, plant_ref, name, token_hash)
  values (
    auth.uid(),
    trim(target_plant_ref),
    coalesce(nullif(trim(device_name), ''), 'Sensor'),
    encode(digest(raw_token, 'sha256'), 'hex')
  )
  returning id into new_device_id;

  return query select new_device_id, raw_token;
end;
$$;

revoke all on function public.create_sensor_device(text, text) from public;
revoke execute on function public.create_sensor_device(text, text) from anon;
grant execute on function public.create_sensor_device(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Notificaciones push reales
--
-- Cada suscripcion es la que entrega el navegador via la Push API para un
-- dispositivo/perfil de navegador puntual (no por usuario -- una persona
-- puede tener varias). La Edge Function send-reminders (service_role, corre
-- por cron) lee tasks del snapshot de cada usuario, y por cada suscripcion
-- activa con tareas vencidas o de hoy sin avisar todavia hoy, envia un push
-- y marca last_notified_date para no repetir el mismo dia.
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  last_notified_date date,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_owner_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push subscriptions own rows" on public.push_subscriptions;
create policy "push subscriptions own rows" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, update, delete on public.push_subscriptions to service_role;

-- ---------------------------------------------------------------------------
-- Cron: dispara send-reminders una vez por dia.
--
-- pg_cron llama a la Edge Function via pg_net con un secreto compartido
-- (no el JWT de un usuario -- este cron no actua como nadie en particular).
-- El secreto se guarda como setting de la base, nunca en este archivo:
-- despues de correr este script, ejecutar UNA VEZ en el SQL Editor
-- (reemplazando los valores reales, sin subir ese comando a ningun repo):
--
--   alter database postgres set app.cron_shared_secret = 'EL_SECRETO';
--   alter database postgres set app.functions_base_url = 'https://PROJECT_REF.supabase.co/functions/v1';
--
-- y despues reconectar (o `select pg_reload_conf();`) para que los settings
-- queden disponibles en las sesiones nuevas que usa pg_cron.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'plantcare-send-reminders';

select cron.schedule(
  'plantcare-send-reminders',
  '0 12 * * *',
  $$
  select net.http_post(
    url := current_setting('app.functions_base_url', true) || '/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_shared_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
