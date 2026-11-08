-- Feedback readers send from the app, read by admins in the admin dashboard.
create type public.feedback_kind as enum ('idea', 'bug', 'other');
create type public.feedback_status as enum ('new', 'resolved');

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  -- Always the sender: the insert policy rejects any other user id.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.feedback_kind not null default 'other',
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  -- Where the reader was when they opened the form, e.g. "title/anilist:30002".
  screen text check (char_length(screen) <= 200),
  platform text check (char_length(platform) <= 20),
  status public.feedback_status not null default 'new',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index feedback_created_at_idx on public.feedback (created_at desc);
create index feedback_user_id_idx on public.feedback (user_id);

alter table public.feedback enable row level security;

create policy "Readers can send feedback as themselves" on public.feedback
  for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'new' and resolved_at is null);

create policy "Readers see their own feedback, admins see all" on public.feedback
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy "Admins can resolve feedback" on public.feedback
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Admins may only change the status fields, never what a reader wrote.
revoke update on public.feedback from authenticated;
grant update (status, resolved_at) on public.feedback to authenticated;

-- Feedback with the sender's name and email, which live outside the client's reach.
create function public.admin_feedback()
returns table (
  id uuid,
  kind public.feedback_kind,
  message text,
  screen text,
  platform text,
  status public.feedback_status,
  created_at timestamptz,
  resolved_at timestamptz,
  user_id uuid,
  email text,
  first_name text,
  last_name text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    f.id, f.kind, f.message, f.screen, f.platform, f.status, f.created_at, f.resolved_at,
    f.user_id, u.email::text, p.first_name, p.last_name
  from public.feedback f
  left join auth.users u on u.id = f.user_id
  left join public.profiles p on p.id = f.user_id
  order by (f.status = 'new') desc, f.created_at desc
  limit 500;
end;
$$;

revoke execute on function public.admin_feedback() from public, anon;
grant execute on function public.admin_feedback() to authenticated;
