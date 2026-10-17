-- Names captured at sign-up.
alter table public.profiles
  add column first_name text,
  add column middle_name text,
  add column last_name text;

-- Create the profile row as soon as the auth user exists, copying the names
-- passed in sign-up metadata. Works even when email confirmation delays the session.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name, middle_name, last_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'middle_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Admins live in their own table so users can't promote themselves by editing
-- their profile. There are no insert/update/delete policies: only SQL or the
-- service role can grant admin, e.g.
--   insert into public.admins (user_id) select id from auth.users where email = '...';
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create policy "Admins can see their own admin row" on public.admins
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- App-wide numbers for the admin dashboard.
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'new_users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'onboarded', (select count(*) from public.profiles where onboarded_at is not null),
    'titles', (select count(*) from public.titles),
    'entries', (select count(*) from public.library_entries),
    'avg_rating', (select round(avg(rating)::numeric, 1) from public.library_entries where rating is not null),
    'by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      from (select status, count(*) as n from public.library_entries group by status) s
    ),
    'by_medium', (
      select coalesce(jsonb_object_agg(medium, n), '{}'::jsonb)
      from (
        select t.medium, count(*) as n
        from public.library_entries e join public.titles t on t.id = e.title_id
        group by t.medium
      ) s
    ),
    'formats', (
      select coalesce(jsonb_object_agg(f, n), '{}'::jsonb)
      from (select unnest(formats) as f, count(*) as n from public.profiles group by 1) s
    ),
    'readers', (
      select coalesce(jsonb_object_agg(coalesce(reader, 'unspecified'), n), '{}'::jsonb)
      from (select reader, count(*) as n from public.profiles where onboarded_at is not null group by reader) s
    ),
    'genres', (
      select coalesce(jsonb_agg(jsonb_build_object('name', g, 'count', n) order by n desc, g), '[]'::jsonb)
      from (select unnest(genres) as g, count(*) as n from public.profiles group by 1) s
    ),
    'signups_14d', (
      select jsonb_agg(
        jsonb_build_object(
          'day', d::date,
          'count', (select count(*) from auth.users u where u.created_at::date = d::date)
        ) order by d
      )
      from generate_series(current_date - 13, current_date, interval '1 day') d
    ),
    'top_titles', (
      select coalesce(jsonb_agg(
        jsonb_build_object('title', t.title, 'medium', t.medium, 'cover_url', t.cover_url, 'count', s.n)
        order by s.n desc, t.title
      ), '[]'::jsonb)
      from (
        select title_id, count(*) as n from public.library_entries
        group by title_id order by n desc limit 8
      ) s
      join public.titles t on t.id = s.title_id
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(a order by (a ->> 'at') desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'who', coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), u.email),
          'title', t.title,
          'status', e.status,
          'at', e.updated_at
        ) as a
        from public.library_entries e
        join public.titles t on t.id = e.title_id
        join auth.users u on u.id = e.user_id
        left join public.profiles p on p.id = e.user_id
        order by e.updated_at desc
        limit 12
      ) r
    )
  ) into result;

  return result;
end;
$$;

-- Every account, for the admin dashboard's user list.
create function public.admin_users()
returns table (
  id uuid,
  email text,
  first_name text,
  middle_name text,
  last_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  onboarded boolean,
  entries bigint,
  is_admin boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.first_name,
    p.middle_name,
    p.last_name,
    u.created_at,
    u.last_sign_in_at,
    p.onboarded_at is not null,
    (select count(*) from public.library_entries e where e.user_id = u.id),
    exists (select 1 from public.admins a where a.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc
  limit 500;
end;
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_users() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_users() to authenticated;
