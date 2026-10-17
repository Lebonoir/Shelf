-- Onboarding answers that seed recommendations before the shelf has anything on it.
create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  reader text check (reader in ('men', 'women')),
  formats public.medium[] not null default '{}',
  genres text[] not null default '{}',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

create policy "Users read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users create own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
