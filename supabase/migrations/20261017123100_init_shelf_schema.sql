-- Applied to the Supabase "Shelf" project (scqumixytvbhetzjbzha) on 2026-10-17.
create type public.medium as enum ('book', 'manga', 'comic');
create type public.read_status as enum ('reading', 'planned', 'completed', 'on_hold', 'dropped');

-- Shared cache of titles pulled from external catalogs (AniList, Open Library, ...)
create table public.titles (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null,
  medium public.medium not null,
  title text not null,
  authors text[] not null default '{}',
  cover_url text,
  synopsis text,
  genres text[] not null default '{}',
  year int,
  total_units int,
  unit text not null default 'page' check (unit in ('page', 'chapter', 'issue')),
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

create table public.library_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title_id uuid not null references public.titles (id) on delete cascade,
  status public.read_status not null default 'planned',
  progress int not null default 0 check (progress >= 0),
  rating smallint check (rating between 1 and 10),
  notes text,
  started_at date,
  finished_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, title_id)
);

create index library_entries_user_status_idx on public.library_entries (user_id, status, updated_at desc);
create index library_entries_title_idx on public.library_entries (title_id);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger library_entries_touch before update on public.library_entries
for each row execute function public.touch_updated_at();

alter table public.titles enable row level security;
alter table public.library_entries enable row level security;

create policy "Signed-in users can read titles" on public.titles
  for select to authenticated using (true);
create policy "Signed-in users can add titles" on public.titles
  for insert to authenticated with check (true);

create policy "Users read own entries" on public.library_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add own entries" on public.library_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own entries" on public.library_entries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own entries" on public.library_entries
  for delete to authenticated using ((select auth.uid()) = user_id);
