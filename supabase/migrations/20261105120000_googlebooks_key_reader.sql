-- The Google Books key lives in Vault (secret "googlebooks_api_key"), set outside migrations.
-- Only the service role (the googlebooks edge function) may read it.
create or replace function public.googlebooks_api_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'googlebooks_api_key' limit 1;
$$;

revoke all on function public.googlebooks_api_key() from public, anon, authenticated;
grant execute on function public.googlebooks_api_key() to service_role;
