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
alter table public.user_app_snapshots enable row level security;

-- Las politicas se borran antes de crearse para que este archivo se pueda
-- volver a ejecutar sin el error 42710 ("policy already exists").
drop policy if exists "profiles own rows" on public.profiles;
drop policy if exists "grow spaces own rows" on public.grow_spaces;
drop policy if exists "plants own rows" on public.plants;
drop policy if exists "tasks own rows" on public.tasks;
drop policy if exists "calendar events own rows" on public.calendar_events;
drop policy if exists "care entries own rows" on public.care_entries;
drop policy if exists "photos own rows" on public.photos;
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
