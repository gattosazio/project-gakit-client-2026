-- Defense-in-depth: block brand-new Google sign-ups at the database level.
--
-- Accounts in this project are invite-only. Admin invites create the
-- auth.users row up front (provider = 'email'), and Google auto-links to that
-- existing row on first sign-in, so this trigger only ever fires for
-- uninvited Google accounts -- which we reject.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor).
-- It is idempotent: re-running drops and recreates the trigger.

create or replace function public.block_uninvited_google_signups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data ->> 'provider' = 'google' then
    raise exception 'Google sign-in is restricted to invited accounts.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Keep the function out of the public API surface (SECURITY DEFINER in public
-- is callable by anon/authenticated by default).
revoke execute on function public.block_uninvited_google_signups() from public, anon, authenticated;

drop trigger if exists block_uninvited_google_signups on auth.users;
create trigger block_uninvited_google_signups
before insert on auth.users
for each row
execute function public.block_uninvited_google_signups();
