-- Photo identification moved from Claude to Gemini.
-- The Gemini key lives in Vault (secret "gemini_api_key"), set outside migrations.
-- Only the service role (the identify-title edge function) may read it.
drop function if exists public.anthropic_api_key();

create or replace function public.gemini_api_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'gemini_api_key' limit 1;
$$;

revoke all on function public.gemini_api_key() from public, anon, authenticated;
grant execute on function public.gemini_api_key() to service_role;
